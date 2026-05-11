import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocService } from '../../../core/services/components/doc.service';
import { DocPageLayout, DEFAULT_PAGE_LAYOUT, PAGE_SIZES, MARGIN_PRESETS } from '../../../core/interfaces/doc';
import { Subject, debounceTime } from 'rxjs';
import Quill from 'quill';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
    selector: 'app-doc',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './doc.html',
    styleUrl: './doc.scss',
    encapsulation: ViewEncapsulation.None
})
export class DocComponent implements OnInit, OnDestroy {
    @Input() docId!: string;

    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;

    private docService = inject(DocService);
    private breadcrumbService = inject(BreadcrumbService);

    quill!: Quill;
    docTitle = signal<string>('Loading...');
    isSaving = signal<boolean>(false);
    wordCount = signal<number>(0);
    charCount = signal<number>(0);

    activeTab = signal<'home' | 'insert' | 'layout' | 'view'>('home');
    currentFormats = signal<Record<string, any>>({});

    pageLayout = signal<DocPageLayout>({ ...DEFAULT_PAGE_LAYOUT });
    zoom = signal<number>(100);
    totalPages = signal<number>(1);
    currentPage = signal<number>(1);
    pagesArray = signal<number[]>([1]);

    readonly PAGE_GAP = 32;

    private contentChangeSubject = new Subject<string>();
    private sub: any;
    private saveSub: any;
    private titleTimeout: any;
    private layoutTimeout: any;

    getPageWidth(): number {
        const s = PAGE_SIZES[this.pageLayout().pageSize];
        return this.pageLayout().orientation === 'portrait' ? s.w : s.h;
    }
    getPageHeight(): number {
        const s = PAGE_SIZES[this.pageLayout().pageSize];
        return this.pageLayout().orientation === 'portrait' ? s.h : s.w;
    }
    getMargins() { return MARGIN_PRESETS[this.pageLayout().margins]; }

    ngOnInit() {
        this.initQuill();
        if (this.docId) {
            this.sub = this.docService.liveDoc$(this.docId).subscribe(doc => {
                if (doc) {
                    this.docTitle.set(doc.name);
                    this.wordCount.set(doc.wordCount || 0);
                    if (doc.pageLayout) {
                        this.pageLayout.set({ ...DEFAULT_PAGE_LAYOUT, ...doc.pageLayout });
                        this.applyPageStyles();
                    }
                    if (this.quill.root.innerHTML === '<p><br></p>' && doc.content) {
                        this.quill.root.innerHTML = doc.content;
                        this.refreshCounts();
                    }
                }
            });
            this.saveSub = this.contentChangeSubject.pipe(debounceTime(1000)).subscribe(async content => {
                this.isSaving.set(true);
                const wc = this.computeWordCount(content);
                this.wordCount.set(wc);
                await this.docService.update(this.docId, { content, wordCount: wc });
                setTimeout(() => this.isSaving.set(false), 500);
            });
        }
    }

    updateTitle(newName: string) {
        this.docTitle.set(newName);
        clearTimeout(this.titleTimeout);
        this.titleTimeout = setTimeout(async () => {
            const trimmed = newName.trim();
            if (trimmed) {
                await this.docService.update(this.docId, { name: trimmed });
                this.breadcrumbService.setTitle(trimmed);
            }
        }, 800);
    }

    private initQuill() {
        this.quill = new Quill(this.editorContainer.nativeElement, {
            theme: 'snow',
            placeholder: 'Start writing your document...',
            modules: { toolbar: false }
        });
        this.quill.on('text-change', () => {
            this.contentChangeSubject.next(this.quill.root.innerHTML);
            this.refreshCounts();
            this.updateActiveFormats();
        });
        this.quill.on('selection-change', () => this.updateActiveFormats());
        this.applyPageStyles();
    }

    /**
     * Applies page dimensions + margins to the editor root
     * and sets CSS custom properties for the repeating page background.
     */
    private applyPageStyles() {
        const m = this.getMargins();
        const pageH = this.getPageHeight();
        const pageW = this.getPageWidth();
        const root = this.quill.root;

        root.style.width = `${pageW}px`;
        root.style.minHeight = `${pageH}px`;
        root.style.paddingTop = `${m.top}px`;
        root.style.paddingBottom = `${m.bottom}px`;
        root.style.paddingLeft = `${m.left}px`;
        root.style.paddingRight = `${m.right}px`;

        const surface = root.closest('.page-surface') as HTMLElement;
        if (surface) {
            surface.style.setProperty('--page-h', `${pageH}px`);
            surface.style.setProperty('--page-gap', `${this.PAGE_GAP}px`);
            surface.style.setProperty('--page-unit', `${pageH + this.PAGE_GAP}px`);
            surface.style.width = `${pageW}px`;
        }

        this.refreshCounts();
    }

    /**
     * Calculates the number of pages based on content height.
     * Sets min-height to fill the last page completely.
     * No DOM manipulation — purely CSS driven, zero jank.
     */
    private ensureFullPages() {
        const pageH = this.getPageHeight();
        const root = this.quill.root;
        const isMobile = window.innerWidth <= 768;

        // Read natural content height (min-height set to 1 page prevents collapse)
        root.style.minHeight = `${pageH}px`;
        const contentH = root.scrollHeight;

        const pages = contentH <= pageH
            ? 1
            : Math.ceil(contentH / pageH);

        // On desktop, we fill complete pages for the "paper" look.
        // On mobile, we avoid massive blank space by only ensuring the minimum content height.
        if (!isMobile) {
            root.style.minHeight = `${pages * pageH}px`;
        } else {
            // Mobile: allow natural growth but ensure at least 1 page worth of space
            root.style.minHeight = `${pageH}px`;
        }

        this.totalPages.set(pages);
        this.pagesArray.set(Array.from({ length: pages }, (_, i) => i + 1));
    }

    // ── Format Tracking ──────────────────────────────────────────────
    private updateActiveFormats() {
        const sel = this.quill.getSelection();
        if (sel) this.currentFormats.set(this.quill.getFormat(sel));
    }

    // ── Ribbon: Text Formatting ──────────────────────────────────────
    toggleFormat(f: string) { this.quill.format(f, !this.currentFormats()[f]); this.updateActiveFormats(); }
    setHeader(l: string) { this.quill.format('header', l === '' ? false : parseInt(l)); this.updateActiveFormats(); }
    setFont(f: string) { this.quill.format('font', f || false); this.updateActiveFormats(); }
    setFontSize(s: string) { this.quill.format('size', s || false); this.updateActiveFormats(); }
    setAlign(a: string) { this.quill.format('align', a || false); this.updateActiveFormats(); }
    setList(t: string) { this.quill.format('list', this.currentFormats()['list'] === t ? false : t); this.updateActiveFormats(); }
    indent(d: '+1' | '-1') { this.quill.format('indent', d); this.updateActiveFormats(); }
    setScript(t: 'sub'|'super') { this.quill.format('script', this.currentFormats()['script'] === t ? false : t); this.updateActiveFormats(); }
    setColor(e: Event) { this.quill.format('color', (e.target as HTMLInputElement).value); }
    setBackground(e: Event) { this.quill.format('background', (e.target as HTMLInputElement).value); }
    clearFormatting() { const s = this.quill.getSelection(); if (s && s.length) this.quill.removeFormat(s.index, s.length); this.updateActiveFormats(); }
    getHeaderValue(): string { const h = this.currentFormats()['header']; return h ? String(h) : ''; }

    // ── Ribbon: Clipboard ────────────────────────────────────────────
    undo() { this.quill.history.undo(); }
    redo() { this.quill.history.redo(); }

    // ── Ribbon: Insert ───────────────────────────────────────────────
    insertLink() {
        const sel = this.quill.getSelection(); if (!sel) return;
        const ex = this.quill.getFormat(sel)['link'];
        const url = prompt('Enter URL:', typeof ex === 'string' ? ex : 'https://');
        if (url !== null) this.quill.format('link', url || false);
    }
    insertImage() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { const r = this.quill.getSelection(true); this.quill.insertEmbed(r.index, 'image', e.target?.result); this.quill.setSelection(r.index + 1, 0); };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }
    insertBlockquote() { this.quill.format('blockquote', !this.currentFormats()['blockquote']); this.updateActiveFormats(); }
    insertCodeBlock() { this.quill.format('code-block', !this.currentFormats()['code-block']); this.updateActiveFormats(); }

    // ── Ribbon: Layout ───────────────────────────────────────────────
    setPageMargins(p: string) { this.pageLayout.update(l => ({ ...l, margins: p as any })); this.applyPageStyles(); this.saveLayout(); }
    setPageOrientation(o: string) { this.pageLayout.update(l => ({ ...l, orientation: o as any })); this.applyPageStyles(); this.saveLayout(); }
    setPageSize(s: string) { this.pageLayout.update(l => ({ ...l, pageSize: s as any })); this.applyPageStyles(); this.saveLayout(); }
    private saveLayout() { clearTimeout(this.layoutTimeout); this.layoutTimeout = setTimeout(() => this.docService.update(this.docId, { pageLayout: this.pageLayout() }), 500); }

    // ── Ribbon: View ─────────────────────────────────────────────────
    zoomIn() { this.zoom.update(z => Math.min(z + 10, 200)); }
    zoomOut() { this.zoom.update(z => Math.max(z - 10, 50)); }
    resetZoom() { this.zoom.set(100); }

    // ── Counting ─────────────────────────────────────────────────────
    private refreshCounts() {
        const text = this.quill.getText().trim();
        this.wordCount.set(text ? text.split(/\s+/).filter(w => w.length > 0).length : 0);
        this.charCount.set(text.length);
        this.ensureFullPages();
    }

    onWorkspaceScroll(event: Event) {
        const el = event.target as HTMLElement;
        const isMobile = window.innerWidth <= 768;
        const zoomScale = isMobile ? 1 : (this.zoom() / 100);
        
        // Seamless layout: page boundary is exactly at pageHeight intervals.
        const unit = this.getPageHeight() * zoomScale;
        this.currentPage.set(Math.max(1, Math.min(Math.floor(el.scrollTop / unit) + 1, this.totalPages())));
    }

    private computeWordCount(html: string): number {
        const div = document.createElement('div');
        div.innerHTML = html;
        const text = (div.textContent || div.innerText || '').trim();
        return text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    }

    ngOnDestroy() { this.sub?.unsubscribe(); this.saveSub?.unsubscribe(); this.contentChangeSubject.complete(); }
}
