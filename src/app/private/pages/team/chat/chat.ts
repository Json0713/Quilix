import {
    Component, OnInit, inject, signal, ViewChild,
    ElementRef, AfterViewChecked, HostListener, effect,
    untracked, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { ChatService } from '../../../../core/services/components/chat.service';
import { ChatMessage, ChatSession } from '../../../../core/database/dexie.models';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';


@Component({
    selector: 'app-team-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, MarkdownPipe],
    templateUrl: './chat.html',
    styleUrl: './chat.scss',
})
export class TeamChat implements OnInit, AfterViewChecked {
    private breadcrumb = inject(BreadcrumbService);
    protected chat = inject(ChatService);
    private cdr = inject(ChangeDetectorRef);

    // ── UI state ──────────────────────────────────────────────────────────
    inputText = '';
    showHistory = signal<boolean>(localStorage.getItem('quilix_team_sidebar_open') === 'true');
    showCanvas = signal<boolean>(false);
    isDropup = signal<boolean>(false);
    canvasContent = signal<string>('');
    shouldScrollToBottom = false;
    isInitializing = signal<boolean>(true);

    // ── Session context menu ──────────────────────────────────────────────
    contextMenuSessionId = signal<string | null>(null);
    renamingSessionId = signal<string | null>(null);
    renameValue = signal<string>('');

    @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
    @ViewChild('chatInput') chatInput!: ElementRef<HTMLTextAreaElement>;

    // ── Suggested starters ────────────────────────────────────────────────
    readonly starters = [
        { icon: 'bi-lightbulb', text: 'Help me brainstorm ideas' },
        { icon: 'bi-code-slash', text: 'Write a code snippet' },
        { icon: 'bi-pencil-square', text: 'Draft an email or message' },
        { icon: 'bi-question-circle', text: 'Explain a concept simply' },
    ];

    constructor() {
        // Automatically sync the active session to LocalStorage whenever it changes
        // This captures both manual selections and AI auto-created sessions
        effect(() => {
            const id = this.chat.activeSessionId();
            if (id) {
                localStorage.setItem('quilix_team_active_session', id);
            }
        });

        // Auto-scroll whenever messages change or AI starts thinking
        effect(() => {
            this.chat.messages();
            this.chat.isLoading();
            untracked(() => {
                this.shouldScrollToBottom = true;
                this.cdr.detectChanges(); // Ensure the flag is picked up
            });
        });
    }

    async ngOnInit() {
        this.breadcrumb.setTitle('Ask Quilix');
        
        // Internal Navigation Check: 
        // If the service already has an active session, we are navigating from another page
        const isInternalNavigation = !!this.chat.activeSessionId();

        await this.chat.loadSessions();

        if (isInternalNavigation) {
            // Force a fresh state when navigating from Dashboard
            this.newChat();
        } else {
            // Attempt to restore the last viewed session on Hard Refresh
            const savedSessionId = localStorage.getItem('quilix_team_active_session');
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

    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.contextMenuSessionId()) {
            this.contextMenuSessionId.set(null);
            this.isDropup.set(false);
        }
    }

    // ── Chat actions ──────────────────────────────────────────────────────

    async sendMessage() {
        const text = this.inputText.trim();
        if (!text || this.chat.isLoading()) return;

        this.inputText = '';
        this.shouldScrollToBottom = true;
        
        // Fix: Explicitly reset textarea height
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
        localStorage.removeItem('quilix_team_active_session');
        this.inputText = '';
        setTimeout(() => this.chatInput?.nativeElement?.focus(), 100);

        // Auto-close sidebar on mobile
        if (window.innerWidth <= 770) {
            this.showHistory.set(false);
        }
    }

    async selectSession(session: ChatSession) {
        await this.chat.setActiveSession(session.id);
        localStorage.setItem('quilix_team_active_session', session.id);
        this.shouldScrollToBottom = true;

        // Auto-close sidebar on mobile
        if (window.innerWidth <= 770) {
            this.showHistory.set(false);
        }
    }

    toggleContextMenu(sessionId: string, event: Event) {
        event.stopPropagation();
        const isOpening = this.contextMenuSessionId() !== sessionId;
        this.contextMenuSessionId.set(isOpening ? sessionId : null);

        if (isOpening) {
            const button = event.currentTarget as HTMLElement;
            if (button) {
                const rect = button.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                // Detect if dropdown would go off-screen or behind footer
                this.isDropup.set(rect.bottom > viewportHeight - 180);
            }
        } else {
            this.isDropup.set(false);
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
            localStorage.setItem('quilix_team_sidebar_open', String(newState));
            return newState;
        });
    }

    toggleCanvas() {
        this.showCanvas.update(v => !v);
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
}
