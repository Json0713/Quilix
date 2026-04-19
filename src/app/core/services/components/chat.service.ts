/**
 * @file chat.service.ts
 * @description
 * Central service for the Quilix AI chatbot.
 * Handles session/message CRUD in IndexedDB and communication with
 * the Vercel serverless function at /api/chat.
 */

import { Injectable, signal } from '@angular/core';
import { db } from '../../database/dexie.service';
import type { ChatSession, ChatMessage } from '../../database/dexie.models';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {

    // ── Reactive state ────────────────────────────────────────────────────────
    readonly sessions = signal<ChatSession[]>([]);
    readonly activeSessionId = signal<string | null>(null);
    readonly messages = signal<ChatMessage[]>([]);
    readonly isLoading = signal<boolean>(false);
    readonly error = signal<string | null>(null);

    // ── API endpoint ──────────────────────────────────────────────────────────
    private get apiUrl(): string {
        // In production, relative path works. In dev, proxy or full URL.
        if (environment.production) {
            return '/api/chat';
        }
        // For local dev, use the Vercel dev server or deployed endpoint
        return '/api/chat';
    }

    // ── Session operations ────────────────────────────────────────────────────

    /** Load all chat sessions sorted by most recently updated. */
    async loadSessions(): Promise<void> {
        const list = await db.chat_sessions
            .orderBy('updatedAt')
            .reverse()
            .toArray();
        this.sessions.set(list);
    }

    /** Create a new chat session and set it as active. */
    async createSession(title: string = 'New Chat'): Promise<ChatSession> {
        const now = Date.now();
        const session: ChatSession = {
            id: crypto.randomUUID(),
            title,
            createdAt: now,
            updatedAt: now,
        };
        await db.chat_sessions.put(session);
        await this.loadSessions();
        await this.setActiveSession(session.id);
        return session;
    }

    /** Switch active session and load its messages. */
    async setActiveSession(sessionId: string): Promise<void> {
        this.activeSessionId.set(sessionId);
        this.error.set(null);
        await this.loadMessages(sessionId);
    }

    /** Rename a session. */
    async renameSession(sessionId: string, newTitle: string): Promise<void> {
        await db.chat_sessions.update(sessionId, { title: newTitle.trim() });
        await this.loadSessions();
    }

    /** Delete a session and all its messages. */
    async deleteSession(sessionId: string): Promise<void> {
        await db.chat_messages.where('sessionId').equals(sessionId).delete();
        await db.chat_sessions.delete(sessionId);

        // If deleting the active session, clear the view
        if (this.activeSessionId() === sessionId) {
            this.activeSessionId.set(null);
            this.messages.set([]);
        }
        await this.loadSessions();
    }

    // ── Message operations ────────────────────────────────────────────────────

    /** Load messages for a given session. */
    private async loadMessages(sessionId: string): Promise<void> {
        const msgs = await db.chat_messages
            .where('[sessionId+timestamp]')
            .between([sessionId, 0], [sessionId, Infinity])
            .toArray();
        this.messages.set(msgs);
    }

    /** Add a message to IndexedDB and update the local signal. */
    private async addMessage(
        sessionId: string,
        role: 'user' | 'model',
        content: string,
    ): Promise<ChatMessage> {
        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            sessionId,
            role,
            content,
            timestamp: Date.now(),
        };
        await db.chat_messages.put(msg);
        this.messages.update(prev => [...prev, msg]);

        // Touch session's updatedAt
        await db.chat_sessions.update(sessionId, { updatedAt: Date.now() });

        return msg;
    }

    // ── Send message to AI ────────────────────────────────────────────────────

    /**
     * Send a user message, persist it, call the API, and persist the reply.
     * If no active session exists, one is created automatically.
     */
    async send(userText: string): Promise<void> {
        if (!userText.trim()) return;

        let sessionId = this.activeSessionId();

        // Auto-create session if needed
        if (!sessionId) {
            const session = await this.createSession(
                userText.trim().substring(0, 60) || 'New Chat'
            );
            sessionId = session.id;
        }

        this.error.set(null);

        // Persist user message
        await this.addMessage(sessionId, 'user', userText.trim());

        // Auto-title: if this is the first user message, use it as the title
        const allMsgs = this.messages();
        const userMsgCount = allMsgs.filter(m => m.role === 'user').length;
        if (userMsgCount === 1) {
            const autoTitle = userText.trim().substring(0, 60);
            await this.renameSession(sessionId, autoTitle);
        }

        // Build conversation history for the API
        const history = this.messages().map(m => ({
            role: m.role,
            content: m.content,
        }));

        this.isLoading.set(true);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
            });

            if (response.status === 429) {
                this.error.set('Daily limit reached. Please try again tomorrow.');
                return;
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                this.error.set(data.error || 'Something went wrong.');
                return;
            }

            const data = await response.json();
            await this.addMessage(sessionId, 'model', data.reply || 'No response.');

            // Refresh sessions list to update ordering
            await this.loadSessions();
        } catch (err) {
            console.error('[ChatService] API error:', err);
            this.error.set('Could not reach the server. Check your connection.');
        } finally {
            this.isLoading.set(false);
        }
    }

    /** Clear the active session view without deleting data. */
    clearActiveSession(): void {
        this.activeSessionId.set(null);
        this.messages.set([]);
        this.error.set(null);
    }
}
