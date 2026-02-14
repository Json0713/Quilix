import { Injectable } from '@angular/core';

import { db } from '../db/app-db';
import { User } from '../interfaces/user';
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
  async exportWorkspace(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    // Fetch directly from DB
    const users = await db.users.toArray();
    const session = await db.sessions.toCollection().first();

    const payload = this.buildBackupPayload(
      'workspace',
      users,
      session
    );

    await this.share.shareOrDownload(
      payload,
      filename ?? `quilix - workspace - ${Date.now()} `,
      format
    );
  }

  async exportCurrentUser(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    const session = await db.sessions.toCollection().first();
    if (!session?.userId) {
      throw new Error('No active session.');
    }

    const user = await db.users.get(session.userId);
    if (!user) {
      throw new Error('Active user not found.');
    }

    const payload = this.buildBackupPayload(
      'user',
      [user],
      session
    );

    const safeName = user.name
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    await this.share.shareOrDownload(
      payload,
      filename ?? `quilix - user - ${safeName} -${Date.now()} `,
      format
    );
  }

  /* ───────────────────────── IMPORT ───────────────────────── */
  async importBackup(
    file: File,
    expectedScope: BackupScope,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<{ importedUsers: User[] }> {

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
  ): Promise<{ importedUsers: User[] }> {

    return await db.transaction('rw', db.users, db.sessions, async () => {
      let importedUsers: User[] = [];

      if (backup.data.users?.length) {
        const mergedUsers = await this.mergeUsers(
          backup.data.users,
          confirmReplace
        );

        // Bulk put (add or replace)
        await db.users.bulkPut(mergedUsers);
        importedUsers = backup.data.users;
      }

      if (scope === 'workspace' && backup.data.session) {
        await db.sessions.clear();
        await db.sessions.add(backup.data.session);
      }

      return { importedUsers };
    });
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
  private buildBackupPayload(
    scope: BackupScope,
    users?: User[],
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
        users,
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

  private async mergeUsers(
    imported: User[],
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<User[]> {

    const existing = await db.users.toArray();

    for (const user of imported) {
      const index = existing.findIndex(
        u => u.name.toLowerCase() === user.name.toLowerCase()
      );

      if (index === -1) {
        existing.push(user);
        continue;
      }

      const shouldReplace = await confirmReplace(user.name);
      if (!shouldReplace) {
        throw new Error('IMPORT_CANCELLED');
      }

      existing[index] = user;
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
