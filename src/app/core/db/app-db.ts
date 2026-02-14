import Dexie, { Table } from 'dexie';
import { User } from '../interfaces/user';
import { Session } from '../interfaces/session';

export class AppDatabase extends Dexie {
    users!: Table<User, string>;
    sessions!: Table<Session, string>;

    constructor() {
        super('QuilixGlobalDB');

        this.version(1).stores({
            users: 'id, name, role, lastActiveAt',
            sessions: 'userId' // We use userId as the primary key for session (single active session per user context)
        });
    }
}

export const db = new AppDatabase();
