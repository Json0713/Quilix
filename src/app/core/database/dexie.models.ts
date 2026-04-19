/**
 * @file dexie.models.ts
 * @description
 * Co-located data-model interfaces for the Quilix IndexedDB schema.
 * Keeping them separate from the service keeps the service file focused
 * on schema definition and upgrade logic only.
 */

/** Represents a contact-form submission stored locally. */
export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    message: string;
    createdAt: number;
}

/** Represents a generic key-value application setting stored in IndexedDB. */
export interface Setting {
    key: string;
    value: any;
}

/** Represents a single AI chat session stored locally in IndexedDB. */
export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

/** Represents a single message within an AI chat session. */
export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
}
