import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { AuthService } from '../auth/auth';
import { BackupShareService } from './backup.share';
import { QuilixBackup } from './backup.types';
import { BackupValidator } from './backup.validator';
import { BackupMigrator } from './backup.migrator';
import { User } from '../interfaces/user';

@Injectable({
  providedIn: 'root',
})
export class BackupService {
  /**
   * Increment ONLY when a breaking backup change happens.
   */
  private readonly VERSION = 1;

  constructor(
    private storage: Storage,
    private auth: AuthService,
    private share: BackupShareService
  ) {}

  /* ───────────────────────── EXPORT ───────────────────────── */
  async exportWorkspace(): Promise<void> {
    const payload: QuilixBackup = {
      app: 'Quilix',
      version: this.VERSION,
      scope: 'workspace',
      exportedAt: Date.now(),
      data: {
        users: this.storage.getUsers(),
        session: this.storage.getSession(),
      },
    };

    await this.share.shareOrDownload(
      payload,
      `quilix-workspace-${Date.now()}.json`
    );
  }

  async exportCurrentUser(): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) {
      throw new Error('No active user.');
    }

    const payload: QuilixBackup = {
      app: 'Quilix',
      version: this.VERSION,
      scope: 'user',
      exportedAt: Date.now(),
      data: {
        users: [user],
        session: this.storage.getSession(),
      },
    };

    await this.share.shareOrDownload(
      payload,
      `quilix-user-${user.name}-${Date.now()}.json`
    );
  }

  /* ───────────────────────── IMPORT ───────────────────────── */
  async importBackup(
    file: File,
    scope: 'workspace' | 'user',
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<{ importedUsers: User[] }> {

    const raw = await this.read(file);
    this.validate(raw);

    // Scope safety
    if (raw.scope !== scope) {
      throw new Error(
        `This file is a ${raw.scope} backup, not a ${scope} backup.`
      );
    }

    const internal: any = {
      ...raw,
      version: raw.version === '0.1.0' ? 0 : raw.version,
    };

    if (
      scope === 'user' &&
      !internal.data?.users &&
      internal.user
    ) {
      internal.data = {
        ...internal.data,
        users: [internal.user],
      };
    }

    const migrated =
      internal.version < this.VERSION
        ? BackupMigrator.migrate(internal, this.VERSION)
        : internal;

    let importedUsers: User[] = [];

    // Users
    if (migrated.data?.users?.length) {
      const users = await this.mergeUsers(
        migrated.data.users,
        confirmReplace
      );

      this.storage.saveUsers(users);
      importedUsers = migrated.data.users;
    }

    // Session ONLY for workspace import
    if (scope === 'workspace' && migrated.data?.session) {
      this.storage.saveSession(migrated.data.session);
    }

    return { importedUsers };
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
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

  private async read(file: File): Promise<QuilixBackup> {
      return JSON.parse(await file.text());
    }
    private validate(payload: QuilixBackup): void {
    if (payload.app !== 'Quilix') {
      throw new Error('Invalid Quilix backup.');
    }

    if (payload.version !== 1 && payload.version !== '0.1.0') {
      throw new Error('Unsupported backup version.');
    }

    if (!payload.scope) {
      throw new Error('Invalid backup scope.');
    }
  }

}
