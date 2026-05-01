/**
 * @file chat.service.ts
 * @description
 * Central service for the Quilix AI chatbot.
 * Handles session/message CRUD in IndexedDB (scoped per workspace),
 * communication with the Vercel serverless function at /api/chat,
 * and canvas document parsing/persistence for the side-panel workspace.
 *
 * Canvas documents are stored as sanitized HTML. AI outputs markdown
 * which is converted via `marked` + `DOMPurify` before storage.
 */

import { Injectable, signal } from '@angular/core';
import { db } from '../../database/dexie.service';
import type { ChatSession, ChatMessage, CanvasDocument } from '../../database/dexie.models';
import { environment } from '../../../../environments/environment';
import { marked } from 'marked';
import DOMPurify, { type Config as PurifyConfig } from 'dompurify';

/** Maximum number of canvas documents a single AI response can create. */
const MAX_CANVAS_PER_RESPONSE = 3;

/** Maximum character length for a single canvas document's content. */
const MAX_CANVAS_CONTENT_LENGTH = 10_000;

/** Regex to match <quilix-canvas title="...">content</quilix-canvas> blocks. */
const CANVAS_TAG_REGEX = /<quilix-canvas\s+title="([^"]{1,120})">([\s\S]*?)<\/quilix-canvas>/g;

/** DOMPurify config for canvas HTML — strict allowlist matching MarkdownPipe. */
const CANVAS_PURIFY_CONFIG: PurifyConfig = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote',
        'pre', 'code', 'div', 'span',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'input',
    ],
    ALLOWED_ATTR: [
        'class', 'href', 'target', 'rel',
        'src', 'alt', 'width', 'height',
        'type', 'checked', 'disabled', 'data-list',
    ],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
};

@Injectable({ providedIn: 'root' })
export class ChatService {

    // ── Reactive state ────────────────────────────────────────────────────────
    readonly sessions = signal<ChatSession[]>([]);
    readonly activeSessionId = signal<string | null>(null);
    readonly messages = signal<ChatMessage[]>([]);
    readonly isLoading = signal<boolean>(false);
    readonly loadingSessionId = signal<string | null>(null);
    readonly error = signal<string | null>(null);
    private lastUserMessage: string | null = null;

    // ── Workspace scope ───────────────────────────────────────────────────────
    private currentWorkspaceId: string | null = null;

    // ── Canvas state ──────────────────────────────────────────────────────────
    readonly canvasDocs = signal<CanvasDocument[]>([]);
    readonly activeCanvasId = signal<string | null>(null);
    readonly canvasUpdated = signal<number>(0);

    // ── API endpoint ──────────────────────────────────────────────────────────
    private get apiUrl(): string {
        if (environment.production) {
            return '/api/chat';
        }
        return '/api/chat';
    }

    // ── Workspace binding ─────────────────────────────────────────────────────

    /**
     * Bind the chat service to a specific workspace.
     * Must be called when a chat component initializes, before loading sessions.
     * This scopes all session operations to the given workspace.
     */
    setWorkspace(workspaceId: string): void {
        if (this.currentWorkspaceId !== workspaceId) {
            this.currentWorkspaceId = workspaceId;
            // Clear state from previous workspace
            this.activeSessionId.set(null);
            this.messages.set([]);
            this.canvasDocs.set([]);
            this.activeCanvasId.set(null);
            this.error.set(null);
            this.lastUserMessage = null;
        }
    }

    /** Get the current workspace ID. */
    getWorkspaceId(): string | null {
        return this.currentWorkspaceId;
    }

    // ── Session operations ────────────────────────────────────────────────────

    /** Load all chat sessions for the current workspace, sorted by most recently updated. */
    async loadSessions(): Promise<void> {
        if (!this.currentWorkspaceId) {
            this.sessions.set([]);
            return;
        }

        const list = await db.chat_sessions
            .where('[workspaceId+updatedAt]')
            .between(
                [this.currentWorkspaceId, 0],
                [this.currentWorkspaceId, Infinity]
            )
            .reverse()
            .toArray();
        this.sessions.set(list);
    }

    /** Create a new chat session in the current workspace and set it as active. */
    async createSession(title: string = 'New Chat'): Promise<ChatSession> {
        if (!this.currentWorkspaceId) {
            throw new Error('[ChatService] No workspace bound. Call setWorkspace() first.');
        }

        const now = Date.now();
        const session: ChatSession = {
            id: crypto.randomUUID(),
            workspaceId: this.currentWorkspaceId,
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

        // Reset canvas state to prevent stale content from previous sessions
        this.canvasDocs.set([]);
        this.activeCanvasId.set(null);

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

        // Only update the local reactive messages if this message belongs to the currently viewed session
        if (sessionId === this.activeSessionId()) {
            this.messages.update(prev => [...prev, msg]);
        }

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

        // Only update local signals if this session is the one currently being viewed
        if (sessionId === this.activeSessionId()) {
            this.canvasDocs.set(docs);

            // Auto-select the most recent document if the current active ID is missing or invalid
            const currentId = this.activeCanvasId();
            if (docs.length > 0) {
                if (!currentId || !docs.some(d => d.id === currentId)) {
                    this.activeCanvasId.set(docs[docs.length - 1].id);
                }
            } else {
                this.activeCanvasId.set(null);
            }
        }
    }

    /** Set the currently viewed canvas document. */
    setActiveCanvas(docId: string | null): void {
        this.activeCanvasId.set(docId);
    }

    /** Save user edits to a canvas document (content is HTML from Quill). */
    async updateCanvasDoc(docId: string, htmlContent: string): Promise<void> {
        const sanitized = DOMPurify.sanitize(
            htmlContent.substring(0, MAX_CANVAS_CONTENT_LENGTH),
            CANVAS_PURIFY_CONFIG
        );
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
     * Extracts canvas documents, converts markdown to sanitized HTML,
     * saves them to IndexedDB, and returns the reply with canvas blocks
     * replaced by inline reference markers.
     */
    private async parseCanvasFromReply(sessionId: string, reply: string): Promise<string> {
        const matches = [...reply.matchAll(CANVAS_TAG_REGEX)];

        if (matches.length === 0) return reply;

        let cleanedReply = reply;
        let docsCreated = 0;

        for (const match of matches) {
            if (docsCreated >= MAX_CANVAS_PER_RESPONSE) break;

            const [fullMatch, title, rawContent] = match;
            const markdownContent = rawContent.trim().substring(0, MAX_CANVAS_CONTENT_LENGTH);

            if (!markdownContent) continue;

            // Convert markdown → HTML → sanitize
            const rawHtml = await marked.parse(markdownContent);
            const sanitizedHtml = DOMPurify.sanitize(rawHtml, CANVAS_PURIFY_CONFIG);

            // SMART UPDATE: Check if a canvas with this title already exists in the session to update it
            const existingDoc = this.canvasDocs().find(d => title.trim().toLowerCase() === d.title.toLowerCase());

            if (existingDoc) {
                await this.updateCanvasDoc(existingDoc.id, sanitizedHtml);
                docsCreated++;

                if (sessionId === this.activeSessionId()) {
                    this.setActiveCanvas(existingDoc.id);
                }

                cleanedReply = cleanedReply.replace(
                    fullMatch,
                    `\n\n📋 **Canvas Updated: "${existingDoc.title}"** — _The document has been updated._\n\n`
                );
            } else {
                const now = Date.now();
                const doc: CanvasDocument = {
                    id: crypto.randomUUID(),
                    sessionId,
                    title: title.trim(),
                    content: sanitizedHtml,
                    createdAt: now,
                    updatedAt: now,
                };

                await db.canvas_documents.put(doc);
                docsCreated++;

                if (sessionId === this.activeSessionId()) {
                    this.setActiveCanvas(doc.id);
                }

                // Replace the canvas block with a clean reference marker
                cleanedReply = cleanedReply.replace(
                    fullMatch,
                    `\n\n📋 **Canvas: "${doc.title}"** — _Saved to your canvas panel._\n\n`
                );
            }
        }

        if (docsCreated > 0) {
            // Reload canvas docs in DB and refresh local signals if session is active
            await this.loadCanvasDocs(sessionId);

            // Only signal the UI to auto-open if this is the active session
            if (sessionId === this.activeSessionId()) {
                this.canvasUpdated.set(Date.now());
            }
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
        this.loadingSessionId.set(sessionId);

        // Build conversation history for the API
        const history = this.messages().map(m => ({
            role: m.role,
            content: m.content,
        }));

        // Inject current canvas context if active
        const activeCanvasId = this.activeCanvasId();
        const activeDoc = this.canvasDocs().find(d => d.id === activeCanvasId);
        if (activeDoc) {
            const contextMsg = `[CONTEXT: The user is currently viewing the canvas document "${activeDoc.title}". Current content: \n${activeDoc.content}\n]`;
            // Add as a pseudo-user message context for the AI
            history.splice(history.length - 1, 0, { role: 'user', content: contextMsg });
        }

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
            this.loadingSessionId.set(null);
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
