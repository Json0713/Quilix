import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, inject, signal, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../../core/services/components/note.service';
import { NoteDocument } from '../../../core/interfaces/note';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import Quill from 'quill';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { WorkspaceService } from '../../../core/services/components/workspace.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { FileManagerService, FileExplorerEntry } from '../../../core/services/components/file-manager.service';
import { db } from '../../../core/database/dexie.service';

// Patch Quill's Cursor blot to avoid TypeError: Cannot read properties of undefined (reading 'composing')
// This occurs when loading content containing '<span class="ql-cursor">' from database,
// because Quill parses the element from DOM but does not pass a selection reference to the constructor.
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
} catch (e) {
    console.error('Failed to patch Quill Cursor blot', e);
}

@Component({
    selector: 'app-note',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './note.html',
    styleUrl: './note.scss',
    encapsulation: ViewEncapsulation.None
})
export class NoteComponent implements OnInit, OnDestroy, OnChanges {
    @Input() noteId!: string;
    @Output() noteSelected = new EventEmitter<string>();
    
    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
    
    private noteService = inject(NoteService);
    private breadcrumbService = inject(BreadcrumbService);
    private spaceService = inject(SpaceService);
    private workspaceService = inject(WorkspaceService);
    private fileSystem = inject(FileSystemService);
    private fileManager = inject(FileManagerService);
    
    quill!: Quill;
    activeDoc = signal<NoteDocument | null>(null);
    noteTitle = signal<string>('Loading...');
    isSaving = signal<boolean>(false);
    saveStatus = signal<string>('Saved to space');
    
    spaceNotes = signal<NoteDocument[]>([]);
    showDropdown = signal<boolean>(false);
    isTitleDuplicate = signal<boolean>(false);
    activeMenu = signal<string | null>(null);

    // Save As and Open File Modal signals
    showSaveAsModal = signal<boolean>(false);
    showOpenModal = signal<boolean>(false);
    foldersList = signal<{ id: string | null; path: string }[]>([]);
    selectedFolderId = signal<string | null>(null);
    saveAsFileName = signal<string>('');
    spaceFiles = signal<{ name: string; path: string; handle?: FileSystemFileHandle; virtualId?: string; parentId: string }[]>([]);
    linkedFilePath = signal<string>('');
    
    private contentChangeSubject = new Subject<string>();
    private titleChangeSubject = new Subject<string>();
    
    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private saveSub?: Subscription;
    private titleSub?: Subscription;
    
    private lastSavedContent = '';
    private activeNoteId: string | null = null;
    private isInitialized = false;

    ngOnInit() {
        this.initQuill();
        this.isInitialized = true;

        if (this.noteId) {
            this.setupNote(this.noteId);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['noteId'] && this.isInitialized) {
            const currentId = changes['noteId'].currentValue;
            const previousId = changes['noteId'].previousValue;
            if (currentId !== previousId) {
                this.setupNote(currentId);
            }
        }
    }

    private async savePendingChanges() {
        const oldId = this.activeNoteId;
        if (!oldId || !this.quill) return;

        const currentContent = this.quill.root.innerHTML;
        const cleanContent = currentContent.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
        
        if (cleanContent !== '<p><br></p>' && cleanContent !== this.lastSavedContent) {
            this.lastSavedContent = cleanContent;
            try {
                await this.noteService.update(oldId, { content: cleanContent });
                const doc = this.activeDoc();
                if (doc) {
                    await this.saveToFile(doc, cleanContent);
                }
            } catch (e) {
                console.error('Failed to save pending changes for note ' + oldId, e);
            }
        }

        // Also check if title is pending
        const currentTitle = this.noteTitle().trim();
        const doc = this.activeDoc();
        if (currentTitle && doc && currentTitle !== doc.name && !this.isTitleDuplicate()) {
            try {
                await this.noteService.update(oldId, { name: currentTitle });
                this.breadcrumbService.setTitle(currentTitle);
            } catch (e) {
                console.error('Failed to save pending title for note ' + oldId, e);
            }
        }
    }

    private async setupNote(newNoteId: string) {
        // Save pending changes of previous note if any
        await this.savePendingChanges();

        // Clear previous subscriptions
        this.unsubscribeAll();

        // Set the active note ID
        this.activeNoteId = newNoteId;

        // Initialize subscriptions for the new note
        this.subscribeToNote(newNoteId);
    }

    private subscribeToNote(noteId: string) {
        this.isSaving.set(false);
        this.saveStatus.set('Saved to space');
        this.isTitleDuplicate.set(false);
        this.linkedFilePath.set('');

        this.sub = this.noteService.liveDoc$(noteId).subscribe(note => {
            if (note) {
                this.activeDoc.set(note);
                this.noteTitle.set(note.name);
                
                // Resolve path if linked to file
                if (note.linkedDirectoryId && note.linkedFileName) {
                    this.resolveLinkedFilePath(note.spaceId, note.linkedDirectoryId, note.linkedFileName);
                    this.saveStatus.set('Saved to space & file');
                } else {
                    this.linkedFilePath.set('');
                    this.saveStatus.set('Saved to space');
                }
                
                // Load space notes for dropdown if not already loaded
                if (this.spaceNotes().length === 0 || this.spaceNotes()[0].spaceId !== note.spaceId) {
                    this.spaceSub?.unsubscribe();
                    this.spaceSub = this.noteService.getNotesForSpace(note.spaceId).subscribe(notes => {
                        this.spaceNotes.set(notes);
                    });
                }
                
                const sanitizedContent = (note.content || '').replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
                const currentContent = this.quill.root.innerHTML;
                if (sanitizedContent !== currentContent && sanitizedContent !== this.lastSavedContent) {
                    const range = this.quill.getSelection();
                    this.quill.root.innerHTML = sanitizedContent;
                    this.lastSavedContent = sanitizedContent;
                    
                    if (range) {
                        setTimeout(() => {
                            try {
                                this.quill.setSelection(range.index, range.length);
                            } catch (e) {
                                // Ignore selection errors
                            }
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
            const currentId = this.activeNoteId;
            if (!currentId || currentId !== noteId) return; // Guard against race conditions
            
            this.isSaving.set(true);
            this.saveStatus.set('Saving...');
            
            const cleanContent = content.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
            this.lastSavedContent = cleanContent;
            
            try {
                await this.noteService.update(currentId, { content: cleanContent });
                const doc = this.activeDoc();
                if (doc) {
                    await this.saveToFile(doc, cleanContent);
                }
                this.saveStatus.set(doc?.linkedDirectoryId ? 'Saved to space & file' : 'Saved to space');
            } catch (e) {
                console.error('Failed to save note', e);
                this.saveStatus.set('Save failed');
            } finally {
                setTimeout(() => {
                    if (this.activeNoteId === noteId) {
                        this.isSaving.set(false);
                    }
                }, 500);
            }
        });
        
        this.titleSub = this.titleChangeSubject.pipe(
            debounceTime(800),
            distinctUntilChanged()
        ).subscribe(async newName => {
            const currentId = this.activeNoteId;
            if (!currentId || currentId !== noteId) return; // Guard against race conditions
            
            const trimmed = newName.trim();
            const doc = this.activeDoc();
            if (trimmed !== '' && doc && !this.isTitleDuplicate()) {
                this.isSaving.set(true);
                this.saveStatus.set('Saving...');
                
                try {
                    await this.noteService.update(currentId, { name: trimmed });
                    this.breadcrumbService.setTitle(trimmed);
                    this.saveStatus.set('Saved to space');
                } catch (e) {
                    console.error('Failed to save title', e);
                    this.saveStatus.set('Save failed');
                } finally {
                    setTimeout(() => {
                        if (this.activeNoteId === noteId) {
                            this.isSaving.set(false);
                        }
                    }, 500);
                }
            }
        });
    }

    updateTitle(newName: string) {
        const doc = this.activeDoc();
        if (!doc) return;
        
        const trimmed = newName.trim();
        this.noteTitle.set(newName); 
        
        const isDuplicate = this.spaceNotes().some(n => 
            n.name.toLowerCase() === trimmed.toLowerCase() && n.id !== doc.id
        );
        this.isTitleDuplicate.set(isDuplicate);
        
        this.titleChangeSubject.next(newName);
    }

    private initQuill() {
        this.quill = new Quill(this.editorContainer.nativeElement, {
            theme: 'snow',
            placeholder: 'Start writing...',
            bounds: this.editorContainer.nativeElement,
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link'],
                    ['clean']
                ]
            }
        });

        this.quill.on('text-change', () => {
            const content = this.quill.root.innerHTML;
            if (content !== '<p><br></p>') {
                 this.contentChangeSubject.next(content);
            }
        });
    }
    
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (this.showDropdown() && !target.closest('.note-dropdown') && !target.closest('.note-icon')) {
            this.showDropdown.set(false);
        }
        if (this.activeMenu() && !target.closest('.menu-container')) {
            this.activeMenu.set(null);
        }
    }

    toggleMenu(menu: string, event: MouseEvent) {
        event.stopPropagation();
        if (this.activeMenu() === menu) {
            this.activeMenu.set(null);
        } else {
            this.activeMenu.set(menu);
        }
    }

    closeMenu() {
        this.activeMenu.set(null);
    }

    // ── NEW NOTE ──
    async createNewNote() {
        const activeDoc = this.activeDoc();
        if (!activeDoc) return;
        
        const finalName = await this.noteService.getAvailableName(activeDoc.spaceId, 'Untitled Note');
        const newDoc = await this.noteService.create(activeDoc.spaceId, finalName);
        this.noteSelected.emit(newDoc.id);
        this.closeMenu();
    }

    // ── SAVE AS FILE ──
    async openSaveAsModal() {
        const doc = this.activeDoc();
        if (!doc) return;

        this.saveAsFileName.set(doc.name + '.html');
        this.selectedFolderId.set('root');
        
        const folders = await this.getSpaceFoldersList(doc.spaceId);
        this.foldersList.set(folders);
        
        this.showSaveAsModal.set(true);
        this.closeMenu();
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
            this.saveStatus.set('Saving file...');

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
                    const resolvedHandle = await this.resolvePathFromDirId(spaceHandle, space.id, folderId);
                    if (resolvedHandle) parentHandle = resolvedHandle;
                }

                // Check collision
                let fileHandle;
                try {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: false });
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) {
                        this.isSaving.set(false);
                        this.saveStatus.set(doc.linkedDirectoryId ? 'Saved to space & file' : 'Saved to space');
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
                        this.saveStatus.set(doc.linkedDirectoryId ? 'Saved to space & file' : 'Saved to space');
                        return;
                    }
                    await db.virtual_entries.update(existing.id, {
                        content: blob,
                        sizeBytes: blob.size,
                        lastModified: Date.now()
                    });
                } else {
                    const newId = crypto.randomUUID();
                    await db.virtual_entries.add({
                        id: newId,
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

            // Save the link in the Note document
            const linkedDirectoryId = folderId || 'root';
            await this.noteService.update(doc.id, {
                linkedDirectoryId,
                linkedFileName: fileName
            });

            this.saveStatus.set('Saved as ' + fileName);
            await this.resolveLinkedFilePath(doc.spaceId, linkedDirectoryId, fileName);
        } catch (e: any) {
            console.error('Save As failed:', e);
            alert('Failed to save file: ' + (e.message || e));
            this.saveStatus.set('Save failed');
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

            const files = await this.getAllFilesInSpace(doc.spaceId, workspace.name, space.folderName);
            this.spaceFiles.set(files);
            this.showOpenModal.set(true);
        } catch (e) {
            console.error('Failed to gather space files', e);
        }
        this.closeMenu();
    }

    async openFile(file: any) {
        const doc = this.activeDoc();
        if (!doc) return;

        this.showOpenModal.set(false);
        
        try {
            // 1. Check if a note is already linked to this file
            const spaceNotes = await db.notes.where('spaceId').equals(doc.spaceId).toArray();
            const existing = spaceNotes.find(n => n.linkedDirectoryId === file.parentId && n.linkedFileName === file.name);
            
            if (existing) {
                this.noteSelected.emit(existing.id);
                return;
            }

            // 2. Read the file content
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

            // 3. Create a new Note document
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newDoc = await this.noteService.create(doc.spaceId, baseName);
            
            // 4. Update the note with the content and link it
            await this.noteService.update(newDoc.id, {
                content: fileContent,
                linkedDirectoryId: file.parentId,
                linkedFileName: file.name
            });

            this.noteSelected.emit(newDoc.id);
        } catch (e) {
            console.error('Failed to open file as note', e);
            alert('Failed to load file content.');
        }
    }

    // ── DIRECT SAVE FILE SYNC ──
    private async saveToFile(doc: NoteDocument, content: string) {
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
                    const resolved = await this.resolvePathFromDirId(spaceHandle, doc.spaceId, doc.linkedDirectoryId);
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
            console.error('Failed to sync note changes to linked file', e);
        }
    }

    // ── HELPERS ──
    async getSpaceFoldersList(spaceId: string): Promise<{ id: string | null; path: string }[]> {
        const folders = await db.virtual_entries
            .where('spaceId')
            .equals(spaceId)
            .filter(e => e.kind === 'directory')
            .toArray();
            
        const folderMap = new Map(folders.map(f => [f.id, f]));
        const result: { id: string | null; path: string }[] = [{ id: null, path: '/' }];
        
        for (const folder of folders) {
            let path = '/' + folder.name;
            let parentId = folder.parentId;
            while (parentId && parentId !== 'root') {
                const parent = folderMap.get(parentId);
                if (parent) {
                    path = '/' + parent.name + path;
                    parentId = parent.parentId;
                } else {
                    break;
                }
            }
            result.push({ id: folder.id, path });
        }
        
        return result.sort((a, b) => a.path.localeCompare(b.path));
    }

    async getAllFilesInSpace(spaceId: string, workspaceName: string, spaceFolderName: string) {
        const mode = await this.fileSystem.getStorageMode();
        const result: { name: string; path: string; handle?: FileSystemFileHandle; virtualId?: string; parentId: string }[] = [];

        if (mode === 'filesystem') {
            const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (!wsHandle) return [];
            const spaceHandle = await wsHandle.getDirectoryHandle(spaceFolderName, { create: false }).catch(() => null);
            if (!spaceHandle) return [];

            const traverse = async (dirHandle: FileSystemDirectoryHandle, currentPath: string, parentId: string) => {
                for await (const entry of (dirHandle as any).values()) {
                    if (entry.name.startsWith('.quilix')) continue;
                    if (entry.kind === 'file') {
                        result.push({
                            name: entry.name,
                            path: currentPath + '/' + entry.name,
                            handle: entry as FileSystemFileHandle,
                            parentId
                        });
                    } else if (entry.kind === 'directory') {
                        const res = await this.fileSystem.readDirectoryId(entry as FileSystemDirectoryHandle);
                        const subdirId = res?.id || 'unknown';
                        await traverse(entry as FileSystemDirectoryHandle, currentPath + '/' + entry.name, subdirId);
                    }
                }
            };
            await traverse(spaceHandle, '', 'root');
        } else {
            const allItems = await db.virtual_entries.where('spaceId').equals(spaceId).toArray();
            const itemMap = new Map(allItems.map(i => [i.id, i]));
            const files = allItems.filter(i => i.kind === 'file');

            for (const file of files) {
                let path = '/' + file.name;
                let parentId = file.parentId;
                while (parentId && parentId !== 'root') {
                    const parent = itemMap.get(parentId);
                    if (parent) {
                        path = '/' + parent.name + path;
                        parentId = parent.parentId;
                    } else {
                        break;
                    }
                }
                result.push({
                    name: file.name,
                    path,
                    virtualId: file.id,
                    parentId: file.parentId
                });
            }
        }
        
        return result.sort((a, b) => a.path.localeCompare(b.path));
    }

    private async resolvePathFromDirId(
        spaceHandle: FileSystemDirectoryHandle,
        spaceId: string,
        entryId: string
    ): Promise<FileSystemDirectoryHandle | null> {
        const chain: string[] = [];
        let currentId: string | null = entryId;

        while (currentId) {
            const entry: any = await db.virtual_entries.get(currentId);
            if (!entry || entry.kind !== 'directory') break;
            chain.unshift(entry.name);
            currentId = entry.parentId === 'root' ? null : entry.parentId;
        }

        let handle: FileSystemDirectoryHandle = spaceHandle;
        for (const name of chain) {
            try {
                handle = await handle.getDirectoryHandle(name, { create: false });
            } catch {
                return null;
            }
        }
        return handle;
    }

    private async resolveLinkedFilePath(spaceId: string, directoryId: string, fileName: string) {
        if (directoryId === 'root') {
            this.linkedFilePath.set('/' + fileName);
            return;
        }
        
        try {
            const folder = await db.virtual_entries.get(directoryId);
            if (!folder) {
                this.linkedFilePath.set('/' + fileName);
                return;
            }
            
            let path = '/' + folder.name;
            let parentId = folder.parentId;
            
            const folders = await db.virtual_entries
                .where('spaceId')
                .equals(spaceId)
                .filter(e => e.kind === 'directory')
                .toArray();
            const folderMap = new Map(folders.map(f => [f.id, f]));
            
            while (parentId && parentId !== 'root') {
                const parent = folderMap.get(parentId);
                if (parent) {
                    path = '/' + parent.name + path;
                    parentId = parent.parentId;
                } else {
                    break;
                }
            }
            
            this.linkedFilePath.set(path + '/' + fileName);
        } catch (e) {
            this.linkedFilePath.set('/' + fileName);
        }
    }

    // ── STANDARD ACTIONS ──
    exportAsTxt() {
        const text = this.quill.getText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.noteTitle() || 'Untitled Note'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportAsHtml() {
        const html = this.quill.root.innerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.noteTitle() || 'Untitled Note'}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async deleteNote() {
        const id = this.activeNoteId;
        if (!id) return;
        
        if (confirm(`Are you sure you want to delete "${this.noteTitle()}"?`)) {
            await this.noteService.delete(id);
            this.noteSelected.emit('');
        }
    }

    undo() {
        (this.quill as any).history?.undo();
    }

    redo() {
        (this.quill as any).history?.redo();
    }

    selectAll() {
        this.quill.setSelection(0, this.quill.getLength());
    }

    showStats() {
        const text = this.quill.getText().trim();
        const chars = text.length;
        const words = text ? text.split(/\s+/).length : 0;
        alert(`Note Statistics:\nWords: ${words}\nCharacters: ${chars}`);
    }

    insertLink() {
        const range = this.quill.getSelection();
        if (range) {
            const url = prompt('Enter link URL:');
            if (url) {
                this.quill.formatText(range.index, range.length, 'link', url);
            }
        } else {
            alert('Please select some text first to insert a link.');
        }
    }

    insertDateTime() {
        const range = this.quill.getSelection();
        const index = range ? range.index : this.quill.getLength() - 1;
        const dateTimeStr = new Date().toLocaleString();
        this.quill.insertText(index, dateTimeStr);
        this.quill.setSelection(index + dateTimeStr.length, 0);
    }

    formatText(format: string) {
        const range = this.quill.getSelection();
        if (range) {
            const currentFormat = this.quill.getFormat(range);
            this.quill.format(format, !currentFormat[format]);
        } else {
            const currentFormat = this.quill.getFormat();
            this.quill.format(format, !currentFormat[format]);
        }
    }

    clearFormatting() {
        const range = this.quill.getSelection();
        if (range) {
            this.quill.removeFormat(range.index, range.length);
        } else {
            this.quill.removeFormat(0, this.quill.getLength());
        }
    }

    printNote() {
        window.print();
    }

    private unsubscribeAll() {
        this.sub?.unsubscribe();
        this.sub = undefined;
        this.spaceSub?.unsubscribe();
        this.spaceSub = undefined;
        this.saveSub?.unsubscribe();
        this.saveSub = undefined;
        this.titleSub?.unsubscribe();
        this.titleSub = undefined;
    }

    ngOnDestroy() {
        this.savePendingChanges().then(() => {
            this.unsubscribeAll();
            this.contentChangeSubject.complete();
            this.titleChangeSubject.complete();
        });
    }
}


