import {
    Component, OnInit, OnDestroy, inject, signal, ViewChild,
    ElementRef, AfterViewChecked, HostListener, effect,
    untracked, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { ChatService } from '../../../../core/services/components/chat.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ChatMessage, ChatSession, CanvasDocument } from '../../../../core/database/dexie.models';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { DropdownService } from '../../../../services/ui/common/dropdown/dropdown.service';
import Quill from 'quill';
import { Subject, debounceTime, takeUntil } from 'rxjs';


@Component({
    selector: 'app-personal-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, MarkdownPipe],
    templateUrl: './chat.html',
    styleUrl: './chat.scss',
})
export class PersonalChat implements OnInit, OnDestroy, AfterViewChecked {
    private breadcrumb = inject(BreadcrumbService);
    protected chat = inject(ChatService);
    private auth = inject(AuthService);
    private cdr = inject(ChangeDetectorRef);
    public dropdownService = inject(DropdownService);

    // ── UI state ──────────────────────────────────────────────────────────
    inputText = '';
    showHistory = signal<boolean>(localStorage.getItem('quilix_personal_sidebar_open') === 'true');
    showCanvas = signal<boolean>(false);
    shouldScrollToBottom = false;
    isInitializing = signal<boolean>(true);

    // ── Canvas state ──────────────────────────────────────────────────────
    confirmingDeleteId = signal<string | null>(null);
    isCanvasDirty = signal(false);
    canvasWidth = signal(380);
    isResizing = false;
    private startX = 0;
    private startWidth = 0;
    private quillInstance: Quill | null = null;
    private autoSaveSubject = new Subject<void>();
    private destroy$ = new Subject<void>();

    // ── Session context menu ──────────────────────────────────────────────
    contextMenuSessionId = signal<string | null>(null);
    renamingSessionId = signal<string | null>(null);
    renameValue = signal<string>('');

    @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
    @ViewChild('chatInput') chatInput!: ElementRef<HTMLTextAreaElement>;
    @ViewChild('quillEditor') quillEditorRef!: ElementRef<HTMLDivElement>;

    // ── Suggested starters ────────────────────────────────────────────────
    readonly starters = [
        { icon: 'bi-lightbulb', text: 'Help me brainstorm ideas' },
        { icon: 'bi-code-slash', text: 'Write a code snippet' },
        { icon: 'bi-pencil-square', text: 'Draft an email or message' },
        { icon: 'bi-question-circle', text: 'Explain a concept simply' },
    ];

    constructor() {
        // Automatically sync the active session to LocalStorage whenever it changes
        effect(() => {
            const id = this.chat.activeSessionId();
            if (id) {
                localStorage.setItem('quilix_personal_active_session', id);
            }
        });

        // Auto-scroll whenever messages change or AI starts thinking
        effect(() => {
            this.chat.messages();
            this.chat.isLoading();
            untracked(() => {
                this.shouldScrollToBottom = true;
                this.cdr.detectChanges();
            });
        });

        // Auto-open canvas panel when a new canvas document is created
        effect(() => {
            const ts = this.chat.canvasUpdated();
            if (ts > 0) {
                untracked(() => {
                    this.showCanvas.set(true);
                    this.loadQuillContent();
                });
            }
        });

        // Sync Quill content when active canvas changes
        effect(() => {
            this.chat.activeCanvasId();
            untracked(() => {
                this.loadQuillContent();
            });
        });

        // Initialize Auto-save
        this.autoSaveSubject.pipe(
            debounceTime(2000),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.saveCanvasEdit();
        });
    }

    async ngOnInit() {
        this.breadcrumb.setTitle('Ask Quilix');

        // Bind chat service to the current workspace
        const workspace = await this.auth.getCurrentWorkspace();
        if (workspace) {
            this.chat.setWorkspace(workspace.id);
        }

        // Internal Navigation Check:
        const isInternalNavigation = !!this.chat.activeSessionId();

        await this.chat.loadSessions();

        if (isInternalNavigation) {
            this.newChat();
        } else {
            const savedSessionId = localStorage.getItem('quilix_personal_active_session');
            if (savedSessionId) {
                const sessions = this.chat.sessions();
                if (sessions.some(s => s.id === savedSessionId)) {
                    await this.chat.setActiveSession(savedSessionId);
                    this.shouldScrollToBottom = true;
                }
            }
        }
        this.isInitializing.set(false);
    }

    ngOnDestroy() {
        if (this.isCanvasDirty()) {
            this.saveCanvasEdit();
        }
        this.destroy$.next();
        this.destroy$.complete();
        this.destroyQuill();
    }

    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
        // Initialize Quill if the container is present but editor isn't created yet
        if (this.quillEditorRef?.nativeElement && !this.quillInstance && this.chat.activeCanvasId()) {
            this.initQuill();
        }
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent): void {
        if (!this.isResizing) return;
        
        const deltaX = this.startX - event.clientX;
        let newWidth = this.startWidth + deltaX;
        
        // Constraints
        const minWidth = 320;
        const maxWidth = Math.min(window.innerWidth * 0.8, 800);
        
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        
        this.canvasWidth.set(newWidth);
    }

    @HostListener('document:mouseup')
    onMouseUp(): void {
        if (this.isResizing) {
            this.isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    }

    startResizing(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isResizing = true;
        this.startX = event.clientX;
        this.startWidth = this.canvasWidth();
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.contextMenuSessionId()) {
            this.contextMenuSessionId.set(null);
            this.dropdownService.reset();
        }
    }

    // ── Quill WYSIWYG ─────────────────────────────────────────────────────

    private initQuill(): void {
        if (this.quillInstance || !this.quillEditorRef?.nativeElement) return;

        // Clean up any lingering Quill elements (like toolbars from previous instances)
        // to prevent stacking when re-initializing.
        const container = this.quillEditorRef.nativeElement.parentElement;
        if (container) {
            const toolbars = container.querySelectorAll('.ql-toolbar');
            toolbars.forEach(tb => tb.remove());
        }
        this.quillEditorRef.nativeElement.innerHTML = '';
        this.quillEditorRef.nativeElement.className = '';

        this.quillInstance = new Quill(this.quillEditorRef.nativeElement, {
            theme: 'snow',
            placeholder: 'Edit your document...',
            modules: {
                toolbar: {
                    container: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                        ['blockquote', 'code-block'],
                        ['link', 'image'],
                        ['copy', 'clean'],
                    ],
                    handlers: {
                        'copy': () => {
                            if (!this.quillInstance) return;
                            const html = this.quillInstance.getSemanticHTML();
                            const text = this.quillInstance.getText();
                            const blobHtml = new Blob([html], { type: 'text/html' });
                            const blobText = new Blob([text], { type: 'text/plain' });
                            const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
                            navigator.clipboard.write(data).then(() => {
                                const toolbar = this.quillEditorRef.nativeElement.parentElement?.querySelector('.ql-toolbar');
                                const btn = toolbar?.querySelector('.ql-copy');
                                if (btn) {
                                    btn.classList.add('ql-success');
                                    setTimeout(() => btn.classList.remove('ql-success'), 2000);
                                }
                            }).catch(() => {
                                navigator.clipboard.writeText(text);
                            });
                        },
                    }
                }
            },
        });

        this.quillInstance.on('text-change', (delta: any, oldDelta: any, source: string) => {
            if (source === 'user') {
                this.isCanvasDirty.set(true);
                this.autoSaveSubject.next();
            }
        });

        this.loadQuillContent();

        // Add tooltips to custom buttons
        const toolbar = this.quillEditorRef.nativeElement.parentElement?.querySelector('.ql-toolbar');
        if (toolbar) {
            toolbar.querySelector('.ql-copy')?.setAttribute('title', 'Copy Canvas (HTML)');
        }
    }

    private destroyQuill(): void {
        if (this.quillInstance) {
            this.quillInstance = null;
        }
        // Safely remove injected Quill elements from the DOM
        if (this.quillEditorRef?.nativeElement) {
            const container = this.quillEditorRef.nativeElement.parentElement;
            if (container) {
                const toolbars = container.querySelectorAll('.ql-toolbar');
                toolbars.forEach(tb => tb.remove());
            }
            this.quillEditorRef.nativeElement.innerHTML = '';
            this.quillEditorRef.nativeElement.className = '';
        }
    }

    private loadQuillContent(): void {
        if (!this.quillInstance) return;
        const doc = this.getActiveCanvasDoc();
        if (doc) {
            this.quillInstance.clipboard.dangerouslyPasteHTML(doc.content || '');
        } else {
            this.quillInstance.setText('');
        }
        this.isCanvasDirty.set(false);
    }

    async saveCanvasEdit(): Promise<void> {
        const docId = this.chat.activeCanvasId();
        if (!docId || !this.quillInstance) return;
        const html = this.quillInstance.getSemanticHTML();
        await this.chat.updateCanvasDoc(docId, html);
        this.isCanvasDirty.set(false);
    }

    // ── Chat actions ──────────────────────────────────────────────────────

    async sendMessage() {
        const text = this.inputText.trim();
        if (!text || this.chat.isLoading()) return;

        this.inputText = '';
        this.shouldScrollToBottom = true;

        if (this.chatInput) {
            this.chatInput.nativeElement.value = '';
            this.resizeTextarea();
        }
        await this.chat.send(text);
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    onInput() {
        this.resizeTextarea();
    }

    private resizeTextarea() {
        const textarea = this.chatInput?.nativeElement;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
        }
    }

    useStarter(text: string) {
        this.inputText = text;
        setTimeout(() => {
            this.chatInput?.nativeElement?.focus();
            this.resizeTextarea();
        }, 50);
    }

    private scrollToBottom(behavior: ScrollBehavior = 'auto') {
        const el = this.messagesContainer?.nativeElement;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior });
        }
    }

    // ── Session management ────────────────────────────────────────────────

    async newChat() {
        this.chat.clearActiveSession();
        localStorage.removeItem('quilix_personal_active_session');
        this.inputText = '';
        this.destroyQuill();
        this.confirmingDeleteId.set(null);
        setTimeout(() => this.chatInput?.nativeElement?.focus(), 100);

        if (window.innerWidth <= 770) {
            this.showHistory.set(false);
        }
    }

    async selectSession(session: ChatSession) {
        this.destroyQuill();
        this.confirmingDeleteId.set(null);
        await this.chat.setActiveSession(session.id);
        localStorage.setItem('quilix_personal_active_session', session.id);
        this.shouldScrollToBottom = true;

        if (window.innerWidth <= 770) {
            this.showHistory.set(false);
        }
    }

    toggleContextMenu(sessionId: string, event: Event) {
        event.stopPropagation();
        const isOpening = this.contextMenuSessionId() !== sessionId;
        this.contextMenuSessionId.set(isOpening ? sessionId : null);

        if (isOpening) {
            this.dropdownService.updatePosition(event, 180);
        } else {
            this.dropdownService.reset();
        }
    }

    startRename(session: ChatSession, event: Event) {
        event.stopPropagation();
        this.contextMenuSessionId.set(null);
        this.renamingSessionId.set(session.id);
        this.renameValue.set(session.title);
    }

    async confirmRename() {
        const id = this.renamingSessionId();
        if (!id) return;
        const val = this.renameValue().trim();
        if (val) {
            await this.chat.renameSession(id, val);
        }
        this.renamingSessionId.set(null);
        this.renameValue.set('');
    }

    cancelRename() {
        this.renamingSessionId.set(null);
        this.renameValue.set('');
    }

    onRenameKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.confirmRename();
        } else if (event.key === 'Escape') {
            this.cancelRename();
        }
    }

    async deleteSession(sessionId: string, event: Event) {
        event.stopPropagation();
        this.contextMenuSessionId.set(null);
        await this.chat.deleteSession(sessionId);
    }

    // ── Panel toggles ─────────────────────────────────────────────────────

    toggleHistory() {
        this.showHistory.update(v => {
            const newState = !v;
            localStorage.setItem('quilix_personal_sidebar_open', String(newState));
            return newState;
        });
    }

    async toggleCanvas() {
        const willOpen = !this.showCanvas();
        if (!willOpen && this.isCanvasDirty()) {
            await this.saveCanvasEdit();
        }
        this.showCanvas.set(willOpen);
        if (!willOpen) {
            this.destroyQuill();
        }
    }

    // ── Canvas actions ────────────────────────────────────────────────────

    getActiveCanvasDoc(): CanvasDocument | undefined {
        return this.chat.canvasDocs().find(d => d.id === this.chat.activeCanvasId());
    }

    async selectCanvasDoc(doc: CanvasDocument): Promise<void> {
        if (this.chat.activeCanvasId() === doc.id) return;
        
        if (this.isCanvasDirty()) {
            await this.saveCanvasEdit();
        }

        this.chat.setActiveCanvas(doc.id);
        this.confirmingDeleteId.set(null);
        this.loadQuillContent();
    }

    /** Start delete confirmation flow. */
    requestDeleteCanvas(docId: string): void {
        this.confirmingDeleteId.set(docId);
    }

    /** Cancel delete confirmation. */
    cancelDeleteCanvas(): void {
        this.confirmingDeleteId.set(null);
    }

    /** Confirm and execute canvas deletion. */
    async confirmDeleteCanvas(): Promise<void> {
        const docId = this.confirmingDeleteId();
        if (!docId) return;
        this.confirmingDeleteId.set(null);
        await this.chat.deleteCanvasDoc(docId);
        this.loadQuillContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatDate(timestamp: number): string {
        const d = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return d.toLocaleDateString();
    }

    trackSession(index: number, session: ChatSession): string {
        return session.id;
    }

    trackMessage(index: number, message: ChatMessage): string {
        return message.id;
    }

    @HostListener('window:beforeunload', ['$event'])
    unloadNotification($event: any) {
        if (this.isCanvasDirty()) {
            $event.returnValue = true;
        }
    }
}
