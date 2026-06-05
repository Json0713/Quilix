import { Component, EventEmitter, Input, Output, inject, signal, effect, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../../core/services/components/chat.service';
import { db } from '../../../../core/database/dexie.service';
import { ChatSession, ChatMessage } from '../../../../core/database/dexie.models';
import { debounceTime, Subject } from 'rxjs';

interface SearchResult {
    session: ChatSession;
    matchedMessages: ChatMessage[];
}

@Component({
    selector: 'app-chat-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat-search.html',
    styleUrl: './chat-search.scss'
})
export class ChatSearchComponent implements AfterViewInit {
    private chat = inject(ChatService);
    
    @Input() visible = false;
    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() sessionSelected = new EventEmitter<string>();

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

    searchQuery = '';
    private searchSubject = new Subject<string>();
    
    isSearching = signal(false);
    results = signal<SearchResult[]>([]);

    constructor() {
        this.searchSubject.pipe(debounceTime(300)).subscribe(query => {
            this.performSearch(query);
        });

        // Focus input when modal becomes visible
        effect(() => {
            if (this.visible && this.searchInput) {
                setTimeout(() => this.searchInput.nativeElement.focus(), 100);
            }
        });
    }

    ngAfterViewInit() {
        if (this.visible && this.searchInput) {
            this.searchInput.nativeElement.focus();
        }
    }

    onSearchInput() {
        this.searchSubject.next(this.searchQuery);
    }

    close() {
        this.visible = false;
        this.searchQuery = '';
        this.results.set([]);
        this.visibleChange.emit(this.visible);
    }

    async selectResult(sessionId: string, messageId?: string) {
        this.sessionSelected.emit(sessionId);
        
        this.chat.searchHighlight.set({ messageId, term: this.searchQuery.trim() });
        
        await this.chat.setActiveSession(sessionId);
        this.close();
    }

    private async performSearch(query: string) {
        if (!query.trim()) {
            this.results.set([]);
            this.isSearching.set(false);
            return;
        }

        this.isSearching.set(true);
        const term = query.toLowerCase();
        const currentWorkspaceId = this.chat.getWorkspaceId();

        if (!currentWorkspaceId) {
            this.results.set([]);
            this.isSearching.set(false);
            return;
        }

        try {
            // Get all sessions for this workspace
            const sessions = await db.chat_sessions
                .where('workspaceId')
                .equals(currentWorkspaceId)
                .toArray();

            const sessionIds = sessions.map(s => s.id);

            // Get all messages for these sessions
            const messages = await db.chat_messages
                .where('sessionId')
                .anyOf(sessionIds)
                .toArray();

            const searchResults: SearchResult[] = [];

            for (const session of sessions) {
                const sessionMessages = messages.filter(m => m.sessionId === session.id);
                const titleMatch = session.title.toLowerCase().includes(term);
                
                const matchedMessages = sessionMessages.filter(m => 
                    m.content.toLowerCase().includes(term)
                );

                if (titleMatch || matchedMessages.length > 0) {
                    searchResults.push({
                        session,
                        matchedMessages: matchedMessages.slice(0, 3) // limit to 3 message previews per session
                    });
                }
            }

            // Sort by most recently updated
            searchResults.sort((a, b) => b.session.updatedAt - a.session.updatedAt);
            
            this.results.set(searchResults);
        } catch (error) {
            console.error('[ChatSearch] Error:', error);
            this.results.set([]);
        } finally {
            this.isSearching.set(false);
        }
    }
}
