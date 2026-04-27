/**
 * @file chat.service.ts
 * @description
 * Central service for the Quilix AI chatbot.
 * Handles session/message CRUD in IndexedDB, communication with
 * the Vercel serverless function at /api/chat, and canvas document
 * parsing/persistence for the side-panel workspace.
 */

import { Injectable, signal } from '@angular/core';
import { db } from '../../database/dexie.service';
import type { ChatSession, ChatMessage, CanvasDocument } from '../../database/dexie.models';
import { environment } from '../../../../environments/environment';

/** Maximum number of canvas documents a single AI response can create. */
const MAX_CANVAS_PER_RESPONSE = 3;

/** Maximum character length for a single canvas document's content. */
const MAX_CANVAS_CONTENT_LENGTH = 10_000;

/** Regex to match <quilix-canvas title="...">content</quilix-canvas> blocks. */
const CANVAS_TAG_REGEX = /<quilix-canvas\s+title="([^"]{1,120})">([\s\S]*?)<\/quilix-canvas>/g;

@Injectable({ providedIn: 'root' })
export class ChatService {

    // ── Reactive state ────────────────────────────────────────────────────────
    readonly sessions = signal<ChatSession[]>([]);
    readonly activeSessionId = signal<string | null>(null);
    readonly messages = signal<ChatMessage[]>([]);
    readonly isLoading = signal<boolean>(false);
    readonly error = signal<string | null>(null);
    private lastUserMessage: string | null = null;

    // ── Canvas state ──────────────────────────────────────────────────────────
    readonly canvasDocs = signal<CanvasDocument[]>([]);
    readonly activeCanvasId = signal<string | null>(null);
    readonly canvasUpdated = signal<number>(0);

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

    /** Switch active session and load its messages + canvas docs. */
    async setActiveSession(sessionId: string): Promise<void> {
        this.activeSessionId.set(sessionId);
        this.error.set(null);
        await this.loadMessages(sessionId);
        await this.loadCanvasDocs(sessionId);
    }

    /** Rename a session. */
    async renameSession(sessionId: string, newTitle: string): Promise<void> {
        await db.chat_sessions.update(sessionId, { title: newTitle.trim() });
        await this.loadSessions();
    }

    /** Delete a session and all its messages + canvas documents. */
    async deleteSession(sessionId: string): Promise<void> {
        await db.chat_messages.where('sessionId').equals(sessionId).delete();
        await db.canvas_documents.where('sessionId').equals(sessionId).delete();
        await db.chat_sessions.delete(sessionId);

        // If deleting the active session, clear the view
        if (this.activeSessionId() === sessionId) {
            this.activeSessionId.set(null);
            this.messages.set([]);
            this.canvasDocs.set([]);
            this.activeCanvasId.set(null);
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

    // ── Canvas operations ─────────────────────────────────────────────────────

    /** Load all canvas documents for a session, ordered by creation time. */
    async loadCanvasDocs(sessionId: string): Promise<void> {
        const docs = await db.canvas_documents
            .where('[sessionId+createdAt]')
            .between([sessionId, 0], [sessionId, Infinity])
            .toArray();
        this.canvasDocs.set(docs);

        // Auto-select the most recent document if none is selected
        if (docs.length > 0 && !this.activeCanvasId()) {
            this.activeCanvasId.set(docs[docs.length - 1].id);
        } else if (docs.length === 0) {
            this.activeCanvasId.set(null);
        }
    }

    /** Set the currently viewed canvas document. */
    setActiveCanvas(docId: string | null): void {
        this.activeCanvasId.set(docId);
    }

    /** Save user edits to a canvas document. */
    async updateCanvasDoc(docId: string, content: string): Promise<void> {
        const sanitized = content.substring(0, MAX_CANVAS_CONTENT_LENGTH);
        await db.canvas_documents.update(docId, {
            content: sanitized,
            updatedAt: Date.now(),
        });

        // Update local signal
        this.canvasDocs.update(docs =>
            docs.map(d => d.id === docId
                ? { ...d, content: sanitized, updatedAt: Date.now() }
                : d
            )
        );
    }

    /** Delete a canvas document. */
    async deleteCanvasDoc(docId: string): Promise<void> {
        await db.canvas_documents.delete(docId);

        this.canvasDocs.update(docs => docs.filter(d => d.id !== docId));

        // If we deleted the active doc, select another or clear
        if (this.activeCanvasId() === docId) {
            const remaining = this.canvasDocs();
            this.activeCanvasId.set(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
        }
    }

    /**
     * Parse <quilix-canvas> tags from an AI response.
     * Extracts canvas documents, saves them to IndexedDB, and returns
     * the reply with canvas blocks replaced by inline reference markers.
     */
    private async parseCanvasFromReply(sessionId: string, reply: string): Promise<string> {
        const matches = [...reply.matchAll(CANVAS_TAG_REGEX)];

        if (matches.length === 0) return reply;

        let cleanedReply = reply;
        let docsCreated = 0;

        for (const match of matches) {
            if (docsCreated >= MAX_CANVAS_PER_RESPONSE) break;

            const [fullMatch, title, rawContent] = match;
            const content = rawContent.trim().substring(0, MAX_CANVAS_CONTENT_LENGTH);

            if (!content) continue;

            const now = Date.now();
            const doc: CanvasDocument = {
                id: crypto.randomUUID(),
                sessionId,
                title: title.trim(),
                content,
                createdAt: now,
                updatedAt: now,
            };

            await db.canvas_documents.put(doc);
            docsCreated++;

            // Replace the canvas block with a clean reference marker
            cleanedReply = cleanedReply.replace(
                fullMatch,
                `\n\n📋 **Canvas: "${doc.title}"** — _Saved to your canvas panel._\n\n`
            );
        }

        if (docsCreated > 0) {
            // Reload canvas docs and auto-select the newest one
            await this.loadCanvasDocs(sessionId);
            const docs = this.canvasDocs();
            if (docs.length > 0) {
                this.activeCanvasId.set(docs[docs.length - 1].id);
            }
            // Signal the UI to auto-open the canvas panel
            this.canvasUpdated.set(Date.now());
        }

        return cleanedReply;
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
        this.lastUserMessage = userText.trim();
        await this.addMessage(sessionId, 'user', userText.trim());

        // Auto-title: if this is the first user message, use it as the title
        const allMsgs = this.messages();
        const userMsgCount = allMsgs.filter(m => m.role === 'user').length;
        if (userMsgCount === 1) {
            const autoTitle = userText.trim().substring(0, 60);
            await this.renameSession(sessionId, autoTitle);
        }

        await this.callChatApi(sessionId);
    }

    /** Inner logic to send current history to API and handle response */
    private async callChatApi(sessionId: string): Promise<void> {
        this.error.set(null);
        this.isLoading.set(true);

        // Build conversation history for the API
        const history = this.messages().map(m => ({
            role: m.role,
            content: m.content,
        }));

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
            const rawReply = data.reply || 'No response.';

            // Parse canvas documents from the AI response
            const cleanReply = await this.parseCanvasFromReply(sessionId, rawReply);

            await this.addMessage(sessionId, 'model', cleanReply);

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
        this.lastUserMessage = null;
        this.canvasDocs.set([]);
        this.activeCanvasId.set(null);
    }

    /** Re-send the last message if an error occurred. */
    async retry(): Promise<void> {
        if (this.isLoading()) return;
        const sessionId = this.activeSessionId();
        if (sessionId && this.lastUserMessage) {
            await this.callChatApi(sessionId);
        }
    }
}
