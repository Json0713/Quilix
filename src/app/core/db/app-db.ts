import Dexie, { Table } from 'dexie';
import { Workspace } from '../interfaces/workspace';
import { Session } from '../interfaces/session';

export class AppDatabase extends Dexie {
    workspaces!: Table<Workspace, string>;
    sessions!: Table<Session, string>;

    constructor() {
        super('QuilixGlobalDB');

        this.version(1).stores({
            workspaces: 'id, name, role, lastActiveAt',
            sessions: 'workspaceId' // workspaceId as PK for session
        });
    }
}

export const db = new AppDatabase();
