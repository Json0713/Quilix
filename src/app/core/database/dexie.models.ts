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
