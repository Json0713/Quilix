import { Injectable } from '@angular/core';

import { Storage } from '../storage/storage';
import { AuthService } from '../auth/auth';

import { Session } from '../interfaces/session';
import { User } from '../interfaces/user';

import { BackupShareService } from './backup.share';
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
    private readonly storage: Storage,
    private readonly auth: AuthService,
    private readonly share: BackupShareService
  ) {}

  /* ───────────────────────── EXPORT ───────────────────────── */
  async exportWorkspace(): Promise<void> {
    const payload = this.buildBackupPayload(
      'workspace',
      this.storage.getUsers(),
      this.storage.getSession()
    );

    await this.share.shareOrDownload(
      payload,
      `quilix-workspace-${Date.now()}`
    );
  }

  async exportCurrentUser(): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) {
      throw new Error('No active user.');
    }

    const payload = this.buildBackupPayload(
      'user',
      [user],
      this.storage.getSession()
    );

    await this.share.shareOrDownload(
      payload,
      `quilix-user-${user.name}-${Date.now()}`
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

    return this.applyBackup(migrated, expectedScope, confirmReplace);
  }

  /* ───────────────────────── APPLY ───────────────────────── */
  private async applyBackup(
    backup: NormalizedBackup,
    scope: BackupScope,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<{ importedUsers: User[] }> {

    let importedUsers: User[] = [];

    if (backup.data?.users?.length) {
      const users = await this.mergeUsers(
        backup.data.users,
        confirmReplace
      );

      this.storage.saveUsers(users);
      importedUsers = backup.data.users;
    }

    if (scope === 'workspace' && backup.data?.session) {
      this.storage.saveSession(backup.data.session);
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
      data: { users, session },
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

    const existing = this.storage.getUsers();

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

  private async readBackupFile(file: File): Promise<QuilixBackup> {
    const text = await file.text();
    return JSON.parse(text);
  }

}
