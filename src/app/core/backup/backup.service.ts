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

    return this.applyBackup(
      migrated,
      expectedScope,
      confirmReplace
    );
  }

  /* ───────────────────────── APPLY ───────────────────────── */
  private async applyBackup(
    backup: NormalizedBackup,
    scope: BackupScope,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<{ importedWorkspaces: Workspace[] }> {

    return await db.transaction('rw', db.workspaces, db.sessions, async () => {
      let importedWorkspaces: Workspace[] = [];

      if (backup.data.workspaces?.length) {
        const merged = await this.mergeWorkspaces(
          backup.data.workspaces,
          confirmReplace
        );

        // Bulk put (add or replace)
        await db.workspaces.bulkPut(merged);
        importedWorkspaces = backup.data.workspaces;
      }

      if (scope === 'appspace' && backup.data.session) {
        await db.sessions.clear();
        await db.sessions.add(backup.data.session);
      }

      return { importedWorkspaces };
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

  private async mergeWorkspaces(
    imported: Workspace[],
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<Workspace[]> {

    const existing = await db.workspaces.toArray();

    for (const workspace of imported) {
      const index = existing.findIndex(
        w => w.name.toLowerCase() === workspace.name.toLowerCase()
      );

      if (index === -1) {
        existing.push(workspace);
        continue;
      }

      const shouldReplace = await confirmReplace(workspace.name);
      if (!shouldReplace) {
        throw new Error('IMPORT_CANCELLED');
      }

      existing[index] = workspace;
    }

    return existing;
  }

  private async readBackupFile(
    file: File
  ): Promise<QuilixBackup> {

    const text = await file.text();
    return JSON.parse(text);
  }

}
