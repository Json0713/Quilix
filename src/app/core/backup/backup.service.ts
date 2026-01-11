import { Injectable } from '@angular/core';

import { AuthFacade } from '../auth/auth.facade';
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
    private readonly auth: AuthFacade,
    private readonly share: BackupShareService
  ) {}

  /* ───────────────────────── EXPORT ───────────────────────── */
  async exportWorkspace(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    const payload = this.buildBackupPayload(
      'workspace',
      this.auth.getUsers(),
      this.auth.getSession()
    );

    await this.share.shareOrDownload(
      payload,
      filename ?? `quilix-workspace-${Date.now()}`,
      format
    );
  }

  async exportCurrentUser(
    format: BackupFileFormat,
    filename?: string
  ): Promise<void> {

    const session = this.auth.getSession();
    if (!session?.userId) {
      throw new Error('No active session.');
    }

    const user = this.auth.getUserById(session.userId);
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
      filename ?? `quilix-user-${safeName}-${Date.now()}`,
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

    let importedUsers: User[] = [];

    if (backup.data.users?.length) {
      const mergedUsers = await this.mergeUsers(
        backup.data.users,
        confirmReplace
      );

      this.auth.saveUsers(mergedUsers);
      importedUsers = backup.data.users;
    }

    if (scope === 'workspace' && backup.data.session) {
      this.auth.saveSession(backup.data.session);
    }

    return { importedUsers };
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
  private buildBackupPayload(
    scope: BackupScope,
    users?: User[],
    session?: Session | null
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
        session,
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

    const existing = this.auth.getUsers();

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
