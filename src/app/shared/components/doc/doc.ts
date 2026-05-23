import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
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

// Patch Quill's Cursor blot to avoid selection composing crashes
try {
    const Cursor = Quill.import('blots/cursor') as any;
    if (Cursor && Cursor.prototype) {
        const originalRestore = Cursor.prototype.restore;
        Cursor.prototype.restore = function() {
            if (!this.selection) {
                const quill = (this.scroll?.domNode?.parentNode as any)?.__quill;
                if (quill && quill.selection) {
                    this.selection = quill.selection;
                } else {
                    this.selection = {
                        composing: false,
                        getNativeRange: () => null
                    };
                }
            }
            return originalRestore.apply(this, arguments);
        };
    }
} catch (e) {}

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

    private docService = inject(DocService);
    private breadcrumbService = inject(BreadcrumbService);
    private spaceService = inject(SpaceService);
    private workspaceService = inject(WorkspaceService);
    private fileSystem = inject(FileSystemService);
    private fileManager = inject(FileManagerService);

    quill!: Quill;
    activeDoc = signal<DocDocument | null>(null);
    docTitle = signal<string>('Loading...');
    isSaving = signal<boolean>(false);
    wordCount = signal<number>(0);
    charCount = signal<number>(0);

    activeTab = signal<'file' | 'home' | 'insert' | 'layout' | 'view'>('home');
    currentFormats = signal<Record<string, any>>({});

    pageLayout = signal<DocPageLayout>({ ...DEFAULT_PAGE_LAYOUT });
    zoom = signal<number>(100);
    totalPages = signal<number>(1);
    currentPage = signal<number>(1);
    pagesArray = signal<number[]>([1]);

    readonly PAGE_GAP = 32;

    // Save As and Open File Modal signals
    showSaveAsModal = signal<boolean>(false);
    showOpenModal = signal<boolean>(false);
    foldersList = signal<{ id: string | null; path: string }[]>([]);
    selectedFolderId = signal<string | null>(null);
    saveAsFileName = signal<string>('');
    spaceFiles = signal<{ name: string; path: string; handle?: FileSystemFileHandle; virtualId?: string; parentId: string }[]>([]);
    linkedFilePath = signal<string>('');
    spaceDocs = signal<DocDocument[]>([]);
    isTitleDuplicate = signal<boolean>(false);

    private contentChangeSubject = new Subject<string>();
    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private saveSub?: Subscription;
    private titleTimeout: any;
    private layoutTimeout: any;
    private lastSavedContent = '';
    private activeDocId: string | null = null;
    private isInitialized = false;

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
        this.isInitialized = true;
        if (this.docId) {
            this.setupDoc(this.docId);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['docId'] && this.isInitialized) {
            const currentId = changes['docId'].currentValue;
            const previousId = changes['docId'].previousValue;
            if (currentId !== previousId) {
                this.setupDoc(currentId);
            }
        }
    }

    private async savePendingChanges() {
        const oldId = this.activeDocId;
        if (!oldId || !this.quill) return;

        const content = this.quill.root.innerHTML;
        const cleanContent = content.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
        
        const doc = this.activeDoc();
        if (doc && cleanContent !== '<p><br></p>' && cleanContent !== doc.content) {
            try {
                const wc = this.computeWordCount(cleanContent);
                await this.docService.update(oldId, { content: cleanContent, wordCount: wc });
                await this.saveToFile(doc, cleanContent);
            } catch (e) {
                console.error('Failed to save pending changes for doc ' + oldId, e);
            }
        }

        // Title pending
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
            if (doc) {
                this.activeDoc.set(doc);
                this.docTitle.set(doc.name);
                this.wordCount.set(doc.wordCount || 0);
                
                if (doc.pageLayout) {
                    this.pageLayout.set({ ...DEFAULT_PAGE_LAYOUT, ...doc.pageLayout });
                    this.applyPageStyles();
                }

                // Resolve path if linked to file
                if (doc.linkedDirectoryId && doc.linkedFileName) {
                    this.fileManager.resolveLinkedFilePath(doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName).then(path => {
                        this.linkedFilePath.set(path);
                    });
                } else {
                    this.linkedFilePath.set('');
                }

                // Check other documents for title duplicates
                if (this.spaceDocs().length === 0 || this.spaceDocs()[0].spaceId !== doc.spaceId) {
                    this.spaceSub?.unsubscribe();
                    this.spaceSub = this.docService.getDocsForSpace(doc.spaceId).subscribe(docs => {
                        this.spaceDocs.set(docs);
                    });
                }

                const sanitizedContent = (doc.content || '').replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
                const currentContent = this.quill.root.innerHTML;
                if (sanitizedContent !== currentContent && sanitizedContent !== this.lastSavedContent) {
                    const range = this.quill.getSelection();
                    this.quill.root.innerHTML = sanitizedContent;
                    this.lastSavedContent = sanitizedContent;
                    if (range) {
                        setTimeout(() => {
                            try { this.quill.setSelection(range.index, range.length); } catch (e) {}
                        }, 0);
                    }
                }
            } else {
                this.activeDoc.set(null);
            }
        });

        this.saveSub = this.contentChangeSubject.pipe(
            debounceTime(1000)
        ).subscribe(async content => {
            const currentId = this.activeDocId;
            if (!currentId || currentId !== docId) return;

            this.isSaving.set(true);
            const cleanContent = content.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
            this.lastSavedContent = cleanContent;
            
            try {
                const wc = this.computeWordCount(cleanContent);
                this.wordCount.set(wc);
                await this.docService.update(currentId, { content: cleanContent, wordCount: wc });
                const doc = this.activeDoc();
                if (doc) {
                    await this.saveToFile(doc, cleanContent);
                }
            } catch (e) {
                console.error('Failed to save document', e);
            } finally {
                setTimeout(() => {
                    if (this.activeDocId === docId) {
                        this.isSaving.set(false);
                    }
                }, 500);
            }
        });
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

    private async saveToFile(doc: DocDocument, content: string) {
        if (!doc.linkedDirectoryId || !doc.linkedFileName) return;
        
        try {
            const space = await db.spaces.get(doc.spaceId);
            if (!space) return;

            const mode = await this.fileSystem.getStorageMode();
            const blob = new Blob([content], { type: 'text/html' });
            
            if (mode === 'filesystem') {
                const workspace = await db.workspaces.get(space.workspaceId);
                if (!workspace) return;
                
                const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) return;
                
                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) return;
                
                let parentHandle = spaceHandle;
                if (doc.linkedDirectoryId !== 'root') {
                    const resolved = await this.fileManager.resolvePathFromDirId(spaceHandle, doc.spaceId, doc.linkedDirectoryId);
                    if (resolved) parentHandle = resolved;
                }
                
                const fileHandle = await parentHandle.getFileHandle(doc.linkedFileName, { create: true });
                const writable = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                // Virtual mode
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName])
                    .first();
                if (existing) {
                    await db.virtual_entries.update(existing.id, {
                        content: blob,
                        sizeBytes: blob.size,
                        lastModified: Date.now()
                    });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(),
                        workspaceId: space.workspaceId,
                        spaceId: doc.spaceId,
                        parentId: doc.linkedDirectoryId,
                        name: doc.linkedFileName,
                        kind: 'file',
                        sizeBytes: blob.size,
                        lastModified: Date.now(),
                        content: blob
                    });
                }
            }
        } catch (e) {
            console.error('Failed to sync doc changes to linked file', e);
        }
    }

    // ── NEW DOCUMENT ──
    async createNewDoc() {
        const doc = this.activeDoc();
        if (!doc) return;
        
        const finalName = await this.docService.getAvailableName(doc.spaceId, 'Untitled Document');
        const newDoc = await this.docService.create(doc.spaceId, finalName);
        this.docSelected.emit(newDoc.id);
    }

    // ── SAVE AS FILE ──
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
        const doc = this.activeDoc();
        if (!doc) return;

        const rawName = this.saveAsFileName().trim();
        if (!rawName) {
            alert('Please enter a valid file name.');
            return;
        }

        let fileName = rawName;
        if (!fileName.includes('.')) {
            fileName += '.html';
        }

        const folderId = this.selectedFolderId() === 'root' ? null : this.selectedFolderId();
        this.showSaveAsModal.set(false);

        try {
            this.isSaving.set(true);
            const mode = await this.fileSystem.getStorageMode();
            const content = this.quill.root.innerHTML;
            const blob = new Blob([content], { type: 'text/html' });

            const space = await this.spaceService.getById(doc.spaceId);
            if (!space) throw new Error('Space not found');

            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) throw new Error('Workspace not found');

            if (mode === 'filesystem') {
                const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) throw new Error('Workspace folder access denied.');

                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) throw new Error('Space folder access denied.');

                let parentHandle = spaceHandle;
                if (folderId) {
                    const resolvedHandle = await this.fileManager.resolvePathFromDirId(spaceHandle, space.id, folderId);
                    if (resolvedHandle) parentHandle = resolvedHandle;
                }

                let fileHandle;
                try {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: false });
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) {
                        this.isSaving.set(false);
                        return;
                    }
                } catch {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
                }

                const writable = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                // Virtual mode
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, folderId || 'root', fileName])
                    .first();

                if (existing) {
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) {
                        this.isSaving.set(false);
                        return;
                    }
                    await db.virtual_entries.update(existing.id, {
                        content: blob,
                        sizeBytes: blob.size,
                        lastModified: Date.now()
                    });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(),
                        workspaceId: space.workspaceId,
                        spaceId: doc.spaceId,
                        parentId: folderId || 'root',
                        name: fileName,
                        kind: 'file',
                        sizeBytes: blob.size,
                        lastModified: Date.now(),
                        content: blob
                    });
                }
            }

            const linkedDirectoryId = folderId || 'root';
            await this.docService.update(doc.id, {
                linkedDirectoryId,
                linkedFileName: fileName
            });

            const path = await this.fileManager.resolveLinkedFilePath(doc.spaceId, linkedDirectoryId, fileName);
            this.linkedFilePath.set(path);
        } catch (e: any) {
            console.error('Save As failed:', e);
            alert('Failed to save file: ' + (e.message || e));
        } finally {
            this.isSaving.set(false);
        }
    }

    // ── OPEN FILE ──
    async openOpenModal() {
        const doc = this.activeDoc();
        if (!doc) return;

        try {
            const space = await this.spaceService.getById(doc.spaceId);
            if (!space) return;
            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) return;

            const files = await this.fileManager.getSpaceFiles(doc.spaceId, workspace.name, space.folderName);
            const docFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm') || f.name.endsWith('.txt'));
            this.spaceFiles.set(docFiles);
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
            // 1. Check if a doc is already linked to this file
            const spaceDocs = await db.docs.where('spaceId').equals(doc.spaceId).toArray();
            const existing = spaceDocs.find(d => d.linkedDirectoryId === file.parentId && d.linkedFileName === file.name);
            
            if (existing) {
                this.docSelected.emit(existing.id);
                return;
            }

            // 2. Read file content
            let fileContent = '';
            const mode = await this.fileSystem.getStorageMode();
            
            if (mode === 'filesystem' && file.handle) {
                const f = await file.handle.getFile();
                fileContent = await f.text();
            } else if (file.virtualId) {
                const ve = await db.virtual_entries.get(file.virtualId);
                if (ve?.content) {
                    fileContent = await ve.content.text();
                }
            }

            // 3. Create a new Doc document
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newDoc = await this.docService.create(doc.spaceId, baseName);
            
            // 4. Update the doc with content and link it
            const wc = this.computeWordCount(fileContent);
            await this.docService.update(newDoc.id, {
                content: fileContent,
                wordCount: wc,
                linkedDirectoryId: file.parentId,
                linkedFileName: file.name
            });

            this.docSelected.emit(newDoc.id);
        } catch (e) {
            console.error('Failed to open file as doc', e);
            alert('Failed to load file content.');
        }
    }

    // ── EXPORTS & DELETION ──
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
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.docTitle() || 'Untitled'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportAsHtml() {
        const html = this.quill.root.innerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.docTitle() || 'Untitled'}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private unsubscribeAll() {
        this.sub?.unsubscribe();
        this.sub = undefined;
        this.spaceSub?.unsubscribe();
        this.spaceSub = undefined;
        this.saveSub?.unsubscribe();
        this.saveSub = undefined;
    }

    ngOnDestroy() {
        this.savePendingChanges().then(() => {
            this.unsubscribeAll();
            this.contentChangeSubject.complete();
        });
    }
}
