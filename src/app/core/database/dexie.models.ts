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

/** Represents a note attached to a specific date in the dashboard calendar. */
export interface WidgetNote {
    id: string;
    date: string; // YYYY-MM-DD
    title: string;
    content: string;
    priority: 'low' | 'medium' | 'high';
    reminderEnabled: boolean;
    reminderTime: string; // HH:mm
    createdAt: number;
}

/** Represents a user-defined alarm for the dashboard clock. */
export interface WidgetAlarm {
    id: string;
    time: string; // HH:mm
    enabled: boolean;
    label: string;
    ringtone: string;
    createdAt: number;
}
