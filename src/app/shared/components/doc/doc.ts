import {
    Component, Input, Output, EventEmitter,
    OnInit, OnDestroy, OnChanges, SimpleChanges,
    ViewChild, ElementRef, HostListener,
    inject, signal, ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocService } from '../../../core/services/components/doc.service';
import { DocPageLayout, DEFAULT_PAGE_LAYOUT, PAGE_SIZES, MARGIN_PRESETS, DocDocument } from '../../../core/interfaces/doc';
import { Subject, Subscription, debounceTime } from 'rxjs';
import Quill from 'quill';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { WorkspaceService } from '../../../core/services/components/workspace.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { FileManagerService } from '../../../core/services/components/file-manager.service';
import { db } from '../../../core/database/dexie.service';

// ── Quill: Register named font families ──────────────────────────────────────
const FontAttributor = Quill.import('attributors/style/font') as any;
FontAttributor.whitelist = [
    'inter', 'roboto', 'georgia', 'times-new-roman',
    'courier-new', 'arial', 'verdana', 'trebuchet-ms'
];
Quill.register(FontAttributor, true);

// ── Quill: Register numeric font sizes (pt-based) ────────────────────────────
const SizeAttributor = Quill.import('attributors/style/size') as any;
SizeAttributor.whitelist = [
    '8pt', '9pt', '10pt', '11pt', '12pt', '14pt',
    '16pt', '18pt', '20pt', '24pt', '28pt', '32pt',
    '36pt', '48pt', '60pt', '72pt'
];
Quill.register(SizeAttributor, true);

// ── Quill: Patch Cursor blot to avoid selection-composing crashes ─────────────
try {
    const Cursor = Quill.import('blots/cursor') as any;
    if (Cursor?.prototype) {
        const originalRestore = Cursor.prototype.restore;
        Cursor.prototype.restore = function () {
            if (!this.selection) {
                const quill = (this.scroll?.domNode?.parentNode as any)?.__quill;
                this.selection = quill?.selection ?? { composing: false, getNativeRange: () => null };
            }
            return originalRestore.apply(this, arguments);
        };
    }
} catch (e) {}

// ── Font/Size option definitions (used in template) ──────────────────────────
export const FONT_OPTIONS = [
    { label: 'Default',          value: '' },
    { label: 'Inter',            value: 'inter' },
    { label: 'Roboto',           value: 'roboto' },
    { label: 'Arial',            value: 'arial' },
    { label: 'Georgia',          value: 'georgia' },
    { label: 'Times New Roman',  value: 'times-new-roman' },
    { label: 'Courier New',      value: 'courier-new' },
    { label: 'Verdana',          value: 'verdana' },
    { label: 'Trebuchet MS',     value: 'trebuchet-ms' },
];

export const SIZE_OPTIONS = [
    { label: '8',  value: '8pt' },
    { label: '9',  value: '9pt' },
    { label: '10', value: '10pt' },
    { label: '11', value: '11pt' },
    { label: '12', value: '12pt' },
    { label: '14', value: '14pt' },
    { label: '16', value: '16pt' },
    { label: '18', value: '18pt' },
    { label: '20', value: '20pt' },
    { label: '24', value: '24pt' },
    { label: '28', value: '28pt' },
    { label: '32', value: '32pt' },
    { label: '36', value: '36pt' },
    { label: '48', value: '48pt' },
    { label: '60', value: '60pt' },
    { label: '72', value: '72pt' },
];

@Component({
    selector: 'app-doc',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './doc.html',
    styleUrl: './doc.scss',
    encapsulation: ViewEncapsulation.None
})
export class DocComponent implements OnInit, OnDestroy, OnChanges {
    @Input() docId!: string;
    @Output() docSelected = new EventEmitter<string>();

    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;

    private docService       = inject(DocService);
    private breadcrumbService = inject(BreadcrumbService);
    private spaceService     = inject(SpaceService);
    private workspaceService = inject(WorkspaceService);
    private fileSystem       = inject(FileSystemService);
    private fileManager      = inject(FileManagerService);

    // ── Expose option lists to template ──────────────────────────────────────
    readonly fontOptions = FONT_OPTIONS;
    readonly sizeOptions = SIZE_OPTIONS;

    // ── Quill instance ────────────────────────────────────────────────────────
    quill!: Quill;

    // ── Document state ────────────────────────────────────────────────────────
    activeDoc        = signal<DocDocument | null>(null);
    docTitle         = signal<string>('Loading...');
    isSaving         = signal<boolean>(false);
    wordCount        = signal<number>(0);
    charCount        = signal<number>(0);
    isTitleDuplicate = signal<boolean>(false);
    linkedFilePath   = signal<string>('');
    spaceDocs        = signal<DocDocument[]>([]);

    // ── Ribbon / Formatting state ─────────────────────────────────────────────
    activeTab      = signal<'file' | 'home' | 'insert' | 'layout' | 'view'>('home');
    currentFormats = signal<Record<string, any>>({});

    // ── Page / Zoom state ─────────────────────────────────────────────────────
    pageLayout  = signal<DocPageLayout>({ ...DEFAULT_PAGE_LAYOUT });
    zoom        = signal<number>(100);
    totalPages  = signal<number>(1);
    currentPage = signal<number>(1);
    pagesArray  = signal<number[]>([1]);

    readonly PAGE_GAP = 32;

    // ── Floating bubble toolbar ───────────────────────────────────────────────
    bubbleVisible = signal<boolean>(false);
    bubbleTop     = signal<number>(0);
    bubbleLeft    = signal<number>(0);

    // ── File/Modal state ──────────────────────────────────────────────────────
    showSaveAsModal  = signal<boolean>(false);
    showOpenModal    = signal<boolean>(false);
    foldersList      = signal<{ id: string | null; path: string }[]>([]);
    selectedFolderId = signal<string | null>(null);
    saveAsFileName   = signal<string>('');
    spaceFiles       = signal<{ name: string; path: string; handle?: FileSystemFileHandle; virtualId?: string; parentId: string }[]>([]);

    // ── Private ───────────────────────────────────────────────────────────────
    private contentChangeSubject = new Subject<string>();
    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private saveSub?: Subscription;
    private titleTimeout: any;
    private layoutTimeout: any;
    private paginationRafId: number | null = null;
    private lastSavedContent = '';
    private activeDocId: string | null = null;
    private isInitialized = false;
    private userZoom = 100; // tracks the user's manual zoom preference

    // ── Page dimension helpers ────────────────────────────────────────────────
    getPageWidth(): number {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            return Math.max(300, window.innerWidth - 24);
        }
        const s = PAGE_SIZES[this.pageLayout().pageSize];
        return this.pageLayout().orientation === 'portrait' ? s.w : s.h;
    }

    getPageHeight(): number {
        const s = PAGE_SIZES[this.pageLayout().pageSize];
        return this.pageLayout().orientation === 'portrait' ? s.h : s.w;
    }

    getTileHeight(): number {
        return this.getPageHeight() + this.PAGE_GAP;
    }

    getMargins() {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            return { top: 32, right: 16, bottom: 32, left: 16 };
        }
        return MARGIN_PRESETS[this.pageLayout().margins];
    }


    // ── Lifecycle ─────────────────────────────────────────────────────────────
    ngOnInit() {
        this.initQuill();
        this.isInitialized = true;
        if (this.docId) this.setupDoc(this.docId);
        this.updateMobileZoom();
    }

    @HostListener('window:resize')
    onWindowResize() {
        this.updateMobileZoom();
    }

    /** On narrow viewports, we keep the zoom at 100% so text remains readable
     *  (no squashed desktop view), and instead make the page width and margins
     *  fully responsive. */
    private updateMobileZoom() {
        const vw = window.innerWidth;

        if (vw <= 768) {
            this.zoom.set(100);
        } else {
            // Restore the user's manual preference on wider screens
            this.zoom.set(this.userZoom);
        }
        this.applyPageStyles();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['docId'] && this.isInitialized) {
            const { currentValue, previousValue } = changes['docId'];
            if (currentValue !== previousValue) this.setupDoc(currentValue);
        }
    }

    // ── Document setup & subscription ─────────────────────────────────────────
    private async savePendingChanges() {
        const oldId = this.activeDocId;
        if (!oldId || !this.quill) return;

        const content = this.getCleanContent();
        const doc = this.activeDoc();

        if (doc && content !== '<p><br></p>' && content !== doc.content) {
            try {
                const wc = this.computeWordCount(content);
                await this.docService.update(oldId, { content, wordCount: wc });
                await this.saveToFile(doc, content);
            } catch (e) {
                console.error('Failed to save pending changes for doc ' + oldId, e);
            }
        }

        const currentTitle = this.docTitle().trim();
        if (currentTitle && doc && currentTitle !== doc.name && !this.isTitleDuplicate()) {
            try {
                await this.docService.update(oldId, { name: currentTitle });
                this.breadcrumbService.setTitle(currentTitle);
            } catch (e) {
                console.error('Failed to save pending title for doc ' + oldId, e);
            }
        }
    }

    private async setupDoc(newDocId: string) {
        await this.savePendingChanges();
        this.unsubscribeAll();
        this.activeDocId = newDocId;
        this.subscribeToDoc(newDocId);
    }

    private subscribeToDoc(docId: string) {
        this.isSaving.set(false);
        this.isTitleDuplicate.set(false);
        this.linkedFilePath.set('');

        this.sub = this.docService.liveDoc$(docId).subscribe(doc => {
            if (!doc) { this.activeDoc.set(null); return; }

            this.activeDoc.set(doc);
            this.docTitle.set(doc.name);
            this.wordCount.set(doc.wordCount || 0);

            if (doc.pageLayout) {
                this.pageLayout.set({ ...DEFAULT_PAGE_LAYOUT, ...doc.pageLayout });
                this.applyPageStyles();
            }

            if (doc.linkedDirectoryId && doc.linkedFileName) {
                this.fileManager.resolveLinkedFilePath(doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName)
                    .then(path => this.linkedFilePath.set(path));
            } else {
                this.linkedFilePath.set('');
            }

            if (this.spaceDocs().length === 0 || this.spaceDocs()[0].spaceId !== doc.spaceId) {
                this.spaceSub?.unsubscribe();
                this.spaceSub = this.docService.getDocsForSpace(doc.spaceId).subscribe(docs => {
                    this.spaceDocs.set(docs);
                });
            }

            const sanitized = this.sanitizeHtml(doc.content || '');
            const current   = this.quill.root.innerHTML;
            if (sanitized !== current && sanitized !== this.lastSavedContent) {
                const range = this.quill.getSelection();
                this.quill.root.innerHTML = sanitized;
                this.lastSavedContent = sanitized;
                if (range) {
                    setTimeout(() => { try { this.quill.setSelection(range.index, range.length); } catch (e) {} }, 0);
                }
            }
        });

        this.saveSub = this.contentChangeSubject.pipe(debounceTime(1000)).subscribe(async content => {
            const currentId = this.activeDocId;
            if (!currentId || currentId !== docId) return;

            this.isSaving.set(true);
            const clean = this.sanitizeHtml(content);
            this.lastSavedContent = clean;

            try {
                const wc = this.computeWordCount(clean);
                this.wordCount.set(wc);
                await this.docService.update(currentId, { content: clean, wordCount: wc });
                const doc = this.activeDoc();
                if (doc) await this.saveToFile(doc, clean);
            } catch (e) {
                console.error('Failed to save document', e);
            } finally {
                setTimeout(() => { if (this.activeDocId === docId) this.isSaving.set(false); }, 500);
            }
        });
    }

    // ── Quill initialization ──────────────────────────────────────────────────
    private initQuill() {
        this.quill = new Quill(this.editorContainer.nativeElement, {
            theme: 'snow',
            placeholder: 'Start writing your document...',
            modules: { toolbar: false, history: { delay: 1000, maxStack: 100, userOnly: true } }
        });

        this.quill.on('text-change', () => {
            this.contentChangeSubject.next(this.quill.root.innerHTML);
            this.refreshCounts();
            this.updateActiveFormats();
        });

        this.quill.on('selection-change', () => {
            this.updateActiveFormats();
        });

        this.applyPageStyles();
    }

    // ── Bubble toolbar (right-click only) ───────────────────────────────────
    /**
     * Shows the bubble toolbar when the user right-clicks on selected text.
     * Suppresses the native context menu only when there is an active selection.
     */
    onEditorContextMenu(event: MouseEvent) {
        const sel = this.quill.getSelection();
        if (!sel || sel.length === 0) {
            // Nothing selected — allow browser context menu.
            return;
        }

        event.preventDefault();

        const workspace = event.currentTarget as HTMLElement;
        const wsRect    = workspace.getBoundingClientRect();
        const BUBBLE_W  = 360;
        const BUBBLE_H  = 44;
        const OFFSET    = 10;

        let left = event.clientX - wsRect.left - BUBBLE_W / 2;
        let top  = event.clientY - wsRect.top + workspace.scrollTop - BUBBLE_H - OFFSET;

        left = Math.max(8, Math.min(left, wsRect.width - BUBBLE_W - 8));
        if (top < workspace.scrollTop + 8) {
            top = event.clientY - wsRect.top + workspace.scrollTop + OFFSET;
        }

        this.updateActiveFormats();
        this.bubbleLeft.set(left);
        this.bubbleTop.set(top);
        this.bubbleVisible.set(true);
    }

    /** Dismiss the bubble toolbar on any regular click in the workspace. */
    onEditorClick() {
        this.bubbleVisible.set(false);
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
        }
    }

    // ── Title ─────────────────────────────────────────────────────────────────
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

    // ── Page styles ───────────────────────────────────────────────────────────
    private applyPageStyles() {
        const m     = this.getMargins();
        const pageH = this.getPageHeight();
        const pageW = this.getPageWidth();
        const root  = this.quill.root;

        root.style.width         = `${pageW}px`;
        root.style.minHeight     = `${pageH}px`;
        root.style.paddingTop    = `${m.top}px`;
        root.style.paddingBottom = `${m.bottom}px`;
        root.style.paddingLeft   = `${m.left}px`;
        root.style.paddingRight  = `${m.right}px`;

        // Keep placeholder aligned to the first typing position
        root.style.setProperty('--placeholder-top',  `${m.top}px`);
        root.style.setProperty('--placeholder-left', `${m.left}px`);

        const surface = root.closest('.page-surface') as HTMLElement;
        if (surface) {
            surface.style.setProperty('--page-h',    `${pageH}px`);
            surface.style.setProperty('--page-gap',  `${this.PAGE_GAP}px`);
            surface.style.setProperty('--page-unit', `${pageH + this.PAGE_GAP}px`);
            surface.style.width = `${pageW}px`;
        }

        this.schedulePagination();
    }

    // ── Pagination Engine ─────────────────────────────────────────────────────
    /**
     * Schedule a pagination pass on the next animation frame, debouncing
     * multiple rapid text-change events into one layout pass.
     */
    private schedulePagination() {
        if (this.paginationRafId !== null) {
            cancelAnimationFrame(this.paginationRafId);
        }
        this.paginationRafId = requestAnimationFrame(() => {
            this.paginationRafId = null;
            this.runPagination();
        });
    }

    /**
     * The pagination engine.
     *
     * Core rules:
     *  1. Reset ALL previously injected margin-top values so we read natural layout.
     *  2. Batch-read all offsetTop / offsetHeight values (single reflow).
     *  3. Walk elements in order, accumulating a virtualTop offset. When an element
     *     would cross the page boundary, compute the push needed to place it at the
     *     start of the next tile and apply it as margin-top-extra via CSS variable.
     *
     * The key fix vs the previous version: we use CSS custom properties instead of
     * overriding margin-top inline, because margin-top override breaks CSS margin
     * collapsing between adjacent <p> elements, causing jitter on delete.
     * Instead we use `padding-top` nudge by wrapping the push into a data attribute
     * read by a CSS rule — but the simpler correct fix is to apply the push as
     * `margin-block-start` (which does not participate in collapse with margin-bottom
     * of the prior sibling). Alternatively: use `margin-top` with the NATURAL
     * margin already excluded (read inline margin only, not computed).
     */
    private runPagination() {
        if (!this.quill) return;

        const pageH   = this.getPageHeight();
        const tileH   = this.getTileHeight();
        const margins = this.getMargins();
        const root    = this.quill.root;
        const children = Array.from(root.children) as HTMLElement[];

        // ── 1. Reset all previously injected margins ──────────────────────
        for (const child of children) {
            if (child.dataset['docPush']) {
                child.style.marginTop = child.dataset['docOrigMt'] ?? '';
                delete child.dataset['docPush'];
                delete child.dataset['docOrigMt'];
            }
        }

        // ── 2. Batch-read natural layout (single reflow) ──────────────────
        const rects = children.map(c => ({
            node:   c,
            top:    c.offsetTop,
            height: c.offsetHeight,
        }));

        // ── 3. Walk and push ──────────────────────────────────────────────
        //
        // HOW THIS WORKS:
        //   Each "page tile" = pageH (e.g. 1056px) + PAGE_GAP (32px) = 1088px.
        //   Page N tile spans [N * tileH,  N * tileH + pageH)   (content zone)
        //                  and [N * tileH + pageH, (N+1) * tileH)  (gap zone).
        //
        //   The content zone for text is further divided:
        //     Top margin:    [pageStart,              pageStart + margins.top)
        //     Writable area: [pageStart + margins.top, pageStart + pageH - margins.bottom)
        //     Bottom margin: [pageStart + pageH - margins.bottom, pageStart + pageH)
        //
        //   An element whose virtualTop lands in the BOTTOM MARGIN zone gets
        //   pushed to the start of the next tile (nextTileStart = (pageIdx+1)*tileH).
        //
        //   SAFETY GUARD: skip elements whose natural r.top is in the top margin
        //   zone of any tile (r.top mod tileH < margins.top + slack). These cannot
        //   possibly be in the bottom margin zone and should never be pushed —
        //   this is what caused the "starts on 2nd page" bug where the first
        //   element got inflated by a stale pushSoFar from a previous doc load.
        let pushSoFar = 0;

        for (const r of rects) {
            const virtualTop = r.top + pushSoFar;

            // Clamp to valid tile: which page does this element land on?
            const pageIdx  = Math.floor(virtualTop / tileH);
            const pageStart = pageIdx * tileH;

            // Where the bottom margin zone begins on this tile
            const contentZoneEnd = pageStart + pageH - margins.bottom;

            // GUARD: if this element's natural position within the tile
            // is in the top-margin zone, it can't be a bottom-margin candidate.
            // (r.top - pageStart * correction) — but since we work in virtual
            // space after resets, use the simpler: element starts before the
            // midpoint of the page → definitionally not in the bottom margin.
            const tileRelative = virtualTop - pageStart;
            const inTopHalf    = tileRelative < pageH / 2;

            if (!inTopHalf && virtualTop >= contentZoneEnd && r.height <= pageH) {
                const nextTileStart = (pageIdx + 1) * tileH;
                const push          = nextTileStart - virtualTop;

                const inlineMt = r.node.style.marginTop
                    ? parseFloat(r.node.style.marginTop) || 0
                    : 0;

                r.node.dataset['docOrigMt'] = r.node.style.marginTop;
                r.node.dataset['docPush']   = String(push);
                r.node.style.marginTop      = `${inlineMt + push}px`;

                pushSoFar += push;
            }
        }

        // ── 4. Update page count ──────────────────────────────────────────
        const pages = Math.max(1, Math.ceil(root.scrollHeight / tileH));
        if (this.totalPages() !== pages) {
            this.totalPages.set(pages);
            this.pagesArray.set(Array.from({ length: pages }, (_, i) => i + 1));
        }
    }




    // ── Format tracking ───────────────────────────────────────────────────────
    private updateActiveFormats() {
        const sel = this.quill.getSelection();
        if (sel) this.currentFormats.set(this.quill.getFormat(sel));
    }

    // ── Formatting commands ───────────────────────────────────────────────────
    toggleFormat(f: string) { this.quill.format(f, !this.currentFormats()[f]); this.updateActiveFormats(); }

    setHeader(l: string)    { this.quill.format('header', l === '' ? false : parseInt(l)); this.updateActiveFormats(); }
    setFont(f: string)      { this.quill.format('font',   f || false); this.updateActiveFormats(); }
    setFontSize(s: string)  { this.quill.format('size',   s || false); this.updateActiveFormats(); }
    setAlign(a: string)     { this.quill.format('align',  a || false); this.updateActiveFormats(); }
    setList(t: string)      { this.quill.format('list', this.currentFormats()['list'] === t ? false : t); this.updateActiveFormats(); }
    indent(d: '+1' | '-1') { this.quill.format('indent', d); this.updateActiveFormats(); }
    setScript(t: 'sub' | 'super') { this.quill.format('script', this.currentFormats()['script'] === t ? false : t); this.updateActiveFormats(); }
    setColor(e: Event)      { this.quill.format('color',      (e.target as HTMLInputElement).value); }
    setBackground(e: Event) { this.quill.format('background', (e.target as HTMLInputElement).value); }

    clearFormatting() {
        const s = this.quill.getSelection();
        if (s && s.length) this.quill.removeFormat(s.index, s.length);
        this.updateActiveFormats();
    }

    getHeaderValue(): string { const h = this.currentFormats()['header']; return h ? String(h) : ''; }
    getCurrentFont(): string { return this.currentFormats()['font'] || ''; }
    getCurrentSize(): string { return this.currentFormats()['size'] || ''; }

    // ── Clipboard / History ───────────────────────────────────────────────────
    undo() { this.quill.history.undo(); }
    redo() { this.quill.history.redo(); }

    // ── View / Zoom ───────────────────────────────────────────────────
    zoomIn() {
        const next = Math.min(this.zoom() + 10, 200);
        this.userZoom = next;
        this.zoom.set(next);
    }
    zoomOut() {
        const next = Math.max(this.zoom() - 10, 50);
        this.userZoom = next;
        this.zoom.set(next);
    }
    resetZoom() {
        this.userZoom = 100;
        this.zoom.set(100);
    }

    onWorkspaceScroll(event: Event) {
        const el        = event.target as HTMLElement;
        const zoomScale = this.zoom() / 100;
        const unit      = this.getTileHeight() * zoomScale;
        this.currentPage.set(Math.max(1, Math.min(Math.floor(el.scrollTop / unit) + 1, this.totalPages())));
        this.bubbleVisible.set(false);
    }

    // ── Insert ────────────────────────────────────────────────────────────────
    insertLink() {
        const sel = this.quill.getSelection();
        if (!sel) return;
        const ex  = this.quill.getFormat(sel)['link'];
        const url = prompt('Enter URL:', typeof ex === 'string' ? ex : 'https://');
        if (url !== null) this.quill.format('link', url || false);
    }

    insertImage() {
        const input  = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const r = this.quill.getSelection(true);
                this.quill.insertEmbed(r.index, 'image', e.target?.result);
                this.quill.setSelection(r.index + 1, 0);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    insertTable() {
        const r = this.quill.getSelection(true);
        const tableHtml = `<table><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>`;
        this.quill.clipboard.dangerouslyPasteHTML(r.index, tableHtml);
    }

    insertHorizontalRule() {
        const r = this.quill.getSelection(true);
        this.quill.insertEmbed(r.index, 'hr', true as any);
        this.quill.setSelection(r.index + 1, 0);
    }

    insertBlockquote() { this.quill.format('blockquote', !this.currentFormats()['blockquote']); this.updateActiveFormats(); }
    insertCodeBlock()  { this.quill.format('code-block', !this.currentFormats()['code-block']); this.updateActiveFormats(); }

    // ── Layout ────────────────────────────────────────────────────────────────
    setPageMargins(p: string)     { this.pageLayout.update(l => ({ ...l, margins: p as any }));     this.applyPageStyles(); this.saveLayout(); }
    setPageOrientation(o: string) { this.pageLayout.update(l => ({ ...l, orientation: o as any })); this.applyPageStyles(); this.saveLayout(); }
    setPageSize(s: string)        { this.pageLayout.update(l => ({ ...l, pageSize: s as any }));    this.applyPageStyles(); this.saveLayout(); }

    private saveLayout() {
        clearTimeout(this.layoutTimeout);
        this.layoutTimeout = setTimeout(() => this.docService.update(this.docId, { pageLayout: this.pageLayout() }), 500);
    }


    // ── Stats ─────────────────────────────────────────────────────────────────
    private refreshCounts() {
        const text = this.quill.getText().trim();
        this.wordCount.set(text ? text.split(/\s+/).filter(w => w.length > 0).length : 0);
        this.charCount.set(text.length);
        this.schedulePagination();
    }

    private computeWordCount(html: string): number {
        const div     = document.createElement('div');
        div.innerHTML = html;
        const text    = (div.textContent || div.innerText || '').trim();
        return text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    }

    private getCleanContent(): string {
        return this.sanitizeHtml(this.quill.root.innerHTML);
    }

    private sanitizeHtml(html: string): string {
        return html
            .replace(/<span class="ql-cursor">.*?<\/span>/g, '')
            .replace(/\uFEFF/g, '');
    }

    // ── File: Save to disk ────────────────────────────────────────────────────
    private async saveToFile(doc: DocDocument, content: string) {
        if (!doc.linkedDirectoryId || !doc.linkedFileName) return;

        try {
            const space = await db.spaces.get(doc.spaceId);
            if (!space) return;

            const mode = await this.fileSystem.getStorageMode();
            const blob = new Blob([content], { type: 'text/html' });

            if (mode === 'filesystem') {
                const workspace  = await db.workspaces.get(space.workspaceId);
                if (!workspace) return;
                const wsHandle   = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) return;
                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) return;

                let parentHandle = spaceHandle;
                if (doc.linkedDirectoryId !== 'root') {
                    const resolved = await this.fileManager.resolvePathFromDirId(spaceHandle, doc.spaceId, doc.linkedDirectoryId);
                    if (resolved) parentHandle = resolved;
                }

                const fileHandle = await parentHandle.getFileHandle(doc.linkedFileName, { create: true });
                const writable   = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName])
                    .first();
                if (existing) {
                    await db.virtual_entries.update(existing.id, { content: blob, sizeBytes: blob.size, lastModified: Date.now() });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(), workspaceId: space.workspaceId,
                        spaceId: doc.spaceId, parentId: doc.linkedDirectoryId,
                        name: doc.linkedFileName, kind: 'file',
                        sizeBytes: blob.size, lastModified: Date.now(), content: blob
                    });
                }
            }
        } catch (e) {
            console.error('Failed to sync doc changes to linked file', e);
        }
    }

    // ── File: Create new ──────────────────────────────────────────────────────
    async createNewDoc() {
        const doc = this.activeDoc();
        if (!doc) return;
        const finalName = await this.docService.getAvailableName(doc.spaceId, 'Untitled Document');
        const newDoc    = await this.docService.create(doc.spaceId, finalName);
        this.docSelected.emit(newDoc.id);
    }

    // ── File: Save As ─────────────────────────────────────────────────────────
    async openSaveAsModal() {
        const doc = this.activeDoc();
        if (!doc) return;
        this.saveAsFileName.set(doc.name + '.html');
        this.selectedFolderId.set('root');
        const folders = await this.fileManager.getSpaceFolders(doc.spaceId);
        this.foldersList.set(folders);
        this.showSaveAsModal.set(true);
    }

    async confirmSaveAs() {
        const doc    = this.activeDoc();
        if (!doc) return;
        const rawName = this.saveAsFileName().trim();
        if (!rawName) { alert('Please enter a valid file name.'); return; }

        let fileName = rawName;
        if (!fileName.includes('.')) fileName += '.html';

        const folderId = this.selectedFolderId() === 'root' ? null : this.selectedFolderId();
        this.showSaveAsModal.set(false);

        try {
            this.isSaving.set(true);
            const mode    = await this.fileSystem.getStorageMode();
            const content = this.quill.root.innerHTML;
            const blob    = new Blob([content], { type: 'text/html' });

            const space     = await this.spaceService.getById(doc.spaceId);
            if (!space) throw new Error('Space not found');
            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) throw new Error('Workspace not found');

            if (mode === 'filesystem') {
                const wsHandle    = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) throw new Error('Workspace folder access denied.');
                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) throw new Error('Space folder access denied.');

                let parentHandle = spaceHandle;
                if (folderId) {
                    const resolved = await this.fileManager.resolvePathFromDirId(spaceHandle, space.id, folderId);
                    if (resolved) parentHandle = resolved;
                }

                let fileHandle;
                try {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: false });
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) { this.isSaving.set(false); return; }
                } catch {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
                }
                const writable = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, folderId || 'root', fileName])
                    .first();
                if (existing) {
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) { this.isSaving.set(false); return; }
                    await db.virtual_entries.update(existing.id, { content: blob, sizeBytes: blob.size, lastModified: Date.now() });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(), workspaceId: space.workspaceId,
                        spaceId: doc.spaceId, parentId: folderId || 'root',
                        name: fileName, kind: 'file',
                        sizeBytes: blob.size, lastModified: Date.now(), content: blob
                    });
                }
            }

            const linkedDirectoryId = folderId || 'root';
            await this.docService.update(doc.id, { linkedDirectoryId, linkedFileName: fileName });
            const path = await this.fileManager.resolveLinkedFilePath(doc.spaceId, linkedDirectoryId, fileName);
            this.linkedFilePath.set(path);
        } catch (e: any) {
            console.error('Save As failed:', e);
            alert('Failed to save file: ' + (e.message || e));
        } finally {
            this.isSaving.set(false);
        }
    }

    // ── File: Open ────────────────────────────────────────────────────────────
    async openOpenModal() {
        const doc = this.activeDoc();
        if (!doc) return;
        try {
            const space     = await this.spaceService.getById(doc.spaceId);
            if (!space) return;
            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) return;
            const files     = await this.fileManager.getSpaceFiles(doc.spaceId, workspace.name, space.folderName);
            this.spaceFiles.set(files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm') || f.name.endsWith('.txt')));
            this.showOpenModal.set(true);
        } catch (e) {
            console.error('Failed to gather space files', e);
        }
    }

    async openFile(file: any) {
        const doc = this.activeDoc();
        if (!doc) return;
        this.showOpenModal.set(false);

        try {
            const spaceDocs = await db.docs.where('spaceId').equals(doc.spaceId).toArray();
            const existing  = spaceDocs.find(d => d.linkedDirectoryId === file.parentId && d.linkedFileName === file.name);
            if (existing) { this.docSelected.emit(existing.id); return; }

            let fileContent = '';
            const mode      = await this.fileSystem.getStorageMode();
            if (mode === 'filesystem' && file.handle) {
                const f     = await file.handle.getFile();
                fileContent = await f.text();
            } else if (file.virtualId) {
                const ve = await db.virtual_entries.get(file.virtualId);
                if (ve?.content) fileContent = await ve.content.text();
            }

            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newDoc   = await this.docService.create(doc.spaceId, baseName);
            const wc       = this.computeWordCount(fileContent);
            await this.docService.update(newDoc.id, {
                content: fileContent, wordCount: wc,
                linkedDirectoryId: file.parentId, linkedFileName: file.name
            });
            this.docSelected.emit(newDoc.id);
        } catch (e) {
            console.error('Failed to open file as doc', e);
            alert('Failed to load file content.');
        }
    }

    // ── Delete & Export ───────────────────────────────────────────────────────
    async deleteDoc() {
        const doc = this.activeDoc();
        if (!doc) return;
        if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
            await this.docService.delete(doc.id);
            this.docSelected.emit('');
        }
    }

    exportAsTxt() {
        const text = this.quill.getText();
        this.downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${this.docTitle() || 'Untitled'}.txt`);
    }

    exportAsHtml() {
        const html = this.quill.root.innerHTML;
        this.downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${this.docTitle() || 'Untitled'}.html`);
    }

    private downloadBlob(blob: Blob, fileName: string) {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    private unsubscribeAll() {
        this.sub?.unsubscribe();      this.sub      = undefined;
        this.spaceSub?.unsubscribe(); this.spaceSub = undefined;
        this.saveSub?.unsubscribe();  this.saveSub  = undefined;
    }

    ngOnDestroy() {
        if (this.paginationRafId !== null) {
            cancelAnimationFrame(this.paginationRafId);
            this.paginationRafId = null;
        }
        this.savePendingChanges().then(() => {
            this.unsubscribeAll();
            this.contentChangeSubject.complete();
        });
    }
}
