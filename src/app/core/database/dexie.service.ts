/**
 * @file dexie.service.ts
 * @description
 * Central Dexie (IndexedDB) database service for Quilix.
 *
 * Architecture decisions:
 *  - Extends Dexie directly (the recommended pattern for Dexie v3+).
 *  - Decorated with @Injectable so Angular's DI system is aware of it.
 *    Angular's DI will always return the same static singleton so there
 *    is never more than one open connection to IndexedDB.
 *  - Static Singleton Pattern: the first constructor call stores itself
 *    on DexieService.instance; subsequent attempts (e.g. the module-level
 *    `db` export) reuse that instance via getInstance().
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
import { ContactMessage, Setting, ChatSession, ChatMessage, WidgetNote, WidgetAlarm } from './dexie.models';

// Re-export models so consumers can import from a single location if needed.
export type { ContactMessage, Setting, ChatSession, ChatMessage, WidgetNote, WidgetAlarm };

@Injectable({ providedIn: 'root' })
export class DexieService extends Dexie {

    // ── Static singleton reference ────────────────────────────────────────────
    private static instance: DexieService;

    // ── Table declarations ────────────────────────────────────────────────────
    workspaces!: Table<Workspace, string>;
    sessions!: Table<Session, string>;
    contacts!: Table<ContactMessage, string>;
    settings!: Table<Setting, string>;
    spaces!: Table<Space, string>;
    tabs!: Table<Tab, string>;
    tasks!: Table<Task, string>;
    virtual_entries!: Table<any, string>;
    activities!: Table<any, string>;
    chat_sessions!: Table<ChatSession, string>;
    chat_messages!: Table<ChatMessage, string>;
    widget_notes!: Table<WidgetNote, string>;
    widget_alarms!: Table<WidgetAlarm, string>;

    constructor() {
        super('QuilixDB');

        // Register the first-ever instance so every subsequent caller
        // (Angular DI, the module-level `db` export, etc.) shares it.
        DexieService.instance = this;

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

        // v11 – Comprehensive activity logging.
        this.version(11).stores({
            activities: 'id, type, category, entityId, timestamp, [category+type], [category+timestamp]'
        });

        // v12 – AI Chat (local-only session + message storage).
        this.version(12).stores({
            chat_sessions: 'id, updatedAt',
            chat_messages: 'id, sessionId, timestamp, [sessionId+timestamp]'
        });

        // v13 – Dashboard Pro Widgets (Notes & Alarms).
        this.version(13).stores({
            widget_notes: 'id, date, createdAt',
            widget_alarms: 'id, time, enabled'
        });

        // v14 – Pro Alarms with customizable ringtones.
        this.version(14).stores({
            widget_alarms: 'id, time, enabled, ringtone'
        });

        // Open the database connection eagerly to reduce first-operation latency.
        this.open().catch(err => {
            console.error('[DexieService] Failed to open database:', err);
        });
    }

    /**
     * Returns the shared singleton instance.
     *
     * Called by the module-level `db` export so it always reuses the same
     * connection that Angular DI creates — preventing duplicate open handles.
     */
    static getInstance(): DexieService {
        return DexieService.instance;
    }
}

/**
 * Application-wide singleton database instance.
 *
 * `getInstance()` returns the instance Angular DI already created.
 * The `|| new DexieService()` fallback handles the edge case where this
 * module is evaluated before Angular's injector has run (e.g. unit tests
 * or a non-Angular bootstrap path).
 *
 * Either way, only ONE connection to IndexedDB is ever open.
 */
export const db = DexieService.getInstance() || new DexieService();
