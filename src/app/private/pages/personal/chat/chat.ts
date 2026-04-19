import {
    Component, OnInit, inject, signal, ViewChild,
    ElementRef, AfterViewChecked, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { ChatService } from '../../../../core/services/components/chat.service';
import { ChatMessage, ChatSession } from '../../../../core/database/dexie.models';


@Component({
    selector: 'app-personal-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.html',
    styleUrl: './chat.scss',
})
export class PersonalChat implements OnInit, AfterViewChecked {
    private breadcrumb = inject(BreadcrumbService);
    protected chat = inject(ChatService);

    // ── UI state ──────────────────────────────────────────────────────────
    inputText = '';
    showHistory = signal<boolean>(true);
    showCanvas = signal<boolean>(false);
    canvasContent = signal<string>('');
    shouldScrollToBottom = false;

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

    async ngOnInit() {
        this.breadcrumb.setTitle('Ask Quilix');
        await this.chat.loadSessions();
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
        }
    }

    // ── Chat actions ──────────────────────────────────────────────────────

    async sendMessage() {
        const text = this.inputText.trim();
        if (!text || this.chat.isLoading()) return;

        this.inputText = '';
        this.shouldScrollToBottom = true;
        this.resizeTextarea();
        await this.chat.send(text);
        this.shouldScrollToBottom = true;
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

    private scrollToBottom() {
        const el = this.messagesContainer?.nativeElement;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }

    // ── Session management ────────────────────────────────────────────────

    async newChat() {
        this.chat.clearActiveSession();
        this.inputText = '';
        setTimeout(() => this.chatInput?.nativeElement?.focus(), 100);
    }

    async selectSession(session: ChatSession) {
        await this.chat.setActiveSession(session.id);
        this.shouldScrollToBottom = true;
    }

    toggleContextMenu(sessionId: string, event: Event) {
        event.stopPropagation();
        this.contextMenuSessionId.set(
            this.contextMenuSessionId() === sessionId ? null : sessionId
        );
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
        this.showHistory.update(v => !v);
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
