import { Injectable } from '@angular/core';

import { db } from '../db/app-db';
import { Workspace } from '../interfaces/workspace';
import { Session } from '../interfaces/session';

import {
  BackupShareService,
  BackupFileFormat,
} from './backup.share';

import {
  QuilixBackup,
  BackupScope,
  BACKUP_VERSION,
} from './backup.types';

import { BackupValidator } from './backup.validator';
import {
  BackupMigrator,
  NormalizedBackup,
} from './backup.migrator';

@Injectable({
  providedIn: 'root',
})
export class BackupService {

  constructor(
    private readonly share: BackupShareService
  ) { }

  /* ───────────────────────── EXPORT ───────────────────────── */
  async exportAppspace(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    // Fetch directly from DB
    const allWorkspaces = await db.workspaces.toArray();
    const session = await db.sessions.toCollection().first();

    const payload = this.buildBackupPayload(
      'appspace',
      allWorkspaces,
      session
    );

    await this.share.shareOrDownload(
      payload,
      filename ?? `quilix - appspace - ${Date.now()} `,
      format
    );
  }

  async exportCurrentWorkspace(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    const session = await db.sessions.toCollection().first();
    if (!session?.workspaceId) {
      throw new Error('No active session.');
    }

    const workspace = await db.workspaces.get(session.workspaceId);
    if (!workspace) {
      throw new Error('Active workspace not found.');
    }

    const payload = this.buildBackupPayload(
      'workspace',
      [workspace],
      session
    );

    const safeName = workspace.name
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    await this.share.shareOrDownload(
      payload,
      filename ?? `quilix - workspace - ${safeName} -${Date.now()} `,
      format
    );
  }

  /* ───────────────────────── IMPORT ───────────────────────── */
  async importBackup(
    file: File,
    expectedScope: BackupScope,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<{ importedWorkspaces: Workspace[] }> {

    const raw = await this.readBackupFile(file);

    BackupValidator.validate(raw);
    this.ensureScope(raw, expectedScope);

    const normalized = BackupMigrator.normalize(raw);

    const migrated =
      normalized.version < BACKUP_VERSION
        ? BackupMigrator.migrate(normalized, BACKUP_VERSION)
        : normalized;

    // Phase 3 Fix: Resolve conflicts BEFORE starting the transaction
    // This prevents TransactionInactiveError by handling UI interaction first.
    const finalWorkspaces = await this.resolveWorkspaces(
      migrated.data.workspaces ?? [],
      confirmReplace
    );

    return this.applyBackup(
      migrated,
      expectedScope,
      finalWorkspaces
    );
  }

  /* ───────────────────────── APPLY ───────────────────────── */
  private async applyBackup(
    backup: NormalizedBackup,
    scope: BackupScope,
    workspacesToSave: Workspace[]
  ): Promise<{ importedWorkspaces: Workspace[] }> {

    return await db.transaction('rw', db.workspaces, db.sessions, async () => {

      if (workspacesToSave.length) {
        // Bulk put (add or replace) - This is now safe as we resolved conflicts already
        await db.workspaces.bulkPut(workspacesToSave);
      }

      if (scope === 'appspace' && backup.data.session) {
        await db.sessions.clear();
        await db.sessions.add(backup.data.session);
      }

      // Return the list of workspaces that were part of the backup
      return { importedWorkspaces: backup.data.workspaces ?? [] };
    });
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
  private buildBackupPayload(
    scope: BackupScope,
    workspaces?: Workspace[],
    session?: Session | undefined
  ): QuilixBackup {

    return {
      app: 'Quilix',
      version: BACKUP_VERSION,
      scope,
      exportedAt: Date.now(),
      meta: {
        createdAt: Date.now(),
      },
      data: {
        workspaces,
        session: session ?? undefined,
      },
    };
  }

  private ensureScope(
    backup: QuilixBackup,
    expected: BackupScope
  ): void {
    if (backup.scope !== expected) {
      throw new Error(
        `This file is a ${backup.scope} backup, not a ${expected} backup.`
      );
    }
  }

  private async resolveWorkspaces(
    imported: Workspace[],
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<Workspace[]> {

    // 1. Get current list outside transaction
    const existing = await db.workspaces.toArray();
    const finalSet = [...existing];

    for (const workspace of imported) {
      const index = finalSet.findIndex(
        w => w.name.toLowerCase() === workspace.name.toLowerCase()
      );

      if (index === -1) {
        finalSet.push(workspace);
        continue;
      }

      // 2. Ask user outside transaction
      const shouldReplace = await confirmReplace(workspace.name);
      if (!shouldReplace) {
        throw new Error('IMPORT_CANCELLED');
      }

      finalSet[index] = workspace;
    }

    return finalSet;
  }

  private async readBackupFile(
    file: File
  ): Promise<QuilixBackup> {

    const text = await file.text();
    return JSON.parse(text);
  }

}
