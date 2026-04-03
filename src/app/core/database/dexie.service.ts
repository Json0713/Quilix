/**
 * @file dexie.service.ts
 * @description
 * Central Dexie (IndexedDB) database service for Quilix.
 *
 * Architecture decisions:
 *  - Extends Dexie directly (the recommended pattern for Dexie v3+).
 *  - Decorated with @Injectable so Angular's DI system is aware of it,
 *    even though consumers use the exported `db` singleton for simplicity.
 *  - Schema versions are incremental and append-only — never modify an
 *    existing version's store definition, only add new versions.
 *  - Data-model interfaces live in the co-located `dexie.models.ts`.
 */

import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

import { Workspace } from '../interfaces/workspace';
import { Space } from '../interfaces/space';
import { Tab } from '../interfaces/tab';
import { Session } from '../interfaces/session';
import { Task } from '../interfaces/task';
import { ContactMessage, Setting } from './dexie.models';

// Re-export models so consumers can import from a single location if needed.
export type { ContactMessage, Setting };

@Injectable({ providedIn: 'root' })
export class DexieService extends Dexie {

    // ── Table declarations ────────────────────────────────────────────────────
    workspaces!: Table<Workspace, string>;
    sessions!: Table<Session, string>;
    contacts!: Table<ContactMessage, string>;
    settings!: Table<Setting, string>;
    spaces!: Table<Space, string>;
    tabs!: Table<Tab, string>;
    tasks!: Table<Task, string>;
    virtual_entries!: Table<any, string>;

    constructor() {
        super('QuilixGlobalDB');

        // ── Schema versions ───────────────────────────────────────────────────
        // IMPORTANT: Never modify a past version's store definition.
        // Only append new versions to guarantee safe upgrades for existing users.

        // v1 – Core workspace and session tables.
        this.version(1).stores({
            workspaces: 'id, name, role, lastActiveAt',
            sessions: 'workspaceId', // workspaceId as primary key
        });

        // v2 – Contact-form submissions.
        this.version(2).stores({
            contacts: 'id, createdAt',
        });

        // v3 – Generic key-value settings store.
        this.version(3).stores({
            settings: 'key',
        });

        // v4 – Spaces (workspaces' sub-areas).
        this.version(4).stores({
            spaces: 'id, workspaceId, order',
        });

        // v5 – Tab system (initial schema).
        this.version(5).stores({
            tabs: 'id, workspaceId, order',
        });

        // v6 – Tabs gain windowId; migrate existing rows to 'default-window'.
        this.version(6).stores({
            tabs: 'id, workspaceId, windowId, order',
        }).upgrade(trans => {
            return trans.table('tabs').toCollection().modify(tab => {
                if (!tab.windowId) {
                    tab.windowId = 'default-window';
                }
            });
        });

        // v7 – Compound index for fast window-scoped tab lookups.
        this.version(7).stores({
            tabs: 'id, workspaceId, windowId, [workspaceId+windowId], order',
        });

        // v8 – Native task storage engine.
        this.version(8).stores({
            tasks: 'id, workspaceId, status, [workspaceId+status], order',
        });

        // v10 – Virtual filesystem storage for IndexedDB mode.
        // (v9 was skipped intentionally to allow headroom for a hotfix.)
        this.version(10).stores({
            virtual_entries: 'id, workspaceId, spaceId, parentId, name, kind, [spaceId+parentId], [spaceId+parentId+name]',
        });

        // Open the database connection eagerly to reduce first-operation latency.
        this.open().catch(err => {
            console.error('[DexieService] Failed to open database:', err);
        });
    }
}

/**
 * Application-wide singleton database instance.
 *
 * Exported as `db` to keep all consumer call-sites concise and unchanged.
 * Using a module-level singleton (rather than pure DI) is the idiomatic
 * Dexie pattern and avoids injector-context issues in async contexts.
 */
export const db = new DexieService();
