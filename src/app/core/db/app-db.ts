import Dexie, { Table } from 'dexie';
import { Workspace } from '../interfaces/workspace';
import { Space } from '../interfaces/space';
import { Tab } from '../interfaces/tab';
import { Session } from '../interfaces/session';

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    message: string;
    createdAt: number;
}

export interface Setting {
    key: string;
    value: any;
}

export class AppDatabase extends Dexie {
    workspaces!: Table<Workspace, string>;
    sessions!: Table<Session, string>;
    contacts!: Table<ContactMessage, string>;
    settings!: Table<Setting, string>;
    spaces!: Table<Space, string>;
    tabs!: Table<Tab, string>;

    constructor() {
        super('QuilixGlobalDB');

        this.version(1).stores({
            workspaces: 'id, name, role, lastActiveAt',
            sessions: 'workspaceId' // workspaceId as PK for session
        });

        this.version(2).stores({
            contacts: 'id, createdAt'
        });

        this.version(3).stores({
            settings: 'key'
        });

        this.version(4).stores({
            spaces: 'id, workspaceId, order'
        });

        this.version(5).stores({
            tabs: 'id, workspaceId, order'
        });

        // Open database connection early to optimize initial load
        this.open().catch(err => {
            console.error('[DB] Failed to open database:', err);
        });
    }
}

export const db = new AppDatabase();
