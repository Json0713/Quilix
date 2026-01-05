import { Injectable } from '@angular/core';
import { Storage } from '../../../core/storage/storage';
import { AuthService } from '../../../core/auth/auth';
import { User } from '../../../core/interfaces/user';
import { Session } from '../../../core/interfaces/session';
import { BackupShareService } from '../share/backup-share';

export interface UserExport {
  app: 'Quilix';
  version: string;
  scope: 'user';
  exportedAt: number;
  user: User;
  data: {
    session: Session;
  };
}

@Injectable({
  providedIn: 'root',
})
export class UserExportImportService {

  private readonly VERSION = '0.1.0';

  constructor(
    private storage: Storage,
    private auth: AuthService,
    private share: BackupShareService
  ) {}

  /** EXPORT CURRENT USER */
  async exportCurrentUser(): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) throw new Error('No active user.');

    const payload: UserExport = {
      app: 'Quilix',
      version: this.VERSION,
      scope: 'user',
      exportedAt: Date.now(),
      user,
      data: {
        session: {
          isLoggedIn: true,
          userId: user.id,
          startedAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      },
    };

    await this.share.shareOrDownload(
      payload,
      `quilix-user-${user.name}-${Date.now()}.json`
    );
  }

  /** IMPORT USER */
  async importUser(
    file: File,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<boolean> {
    const parsed = await this.read(file);
    this.validate(parsed);

    const users = this.storage.getUsers();
    const index = users.findIndex(
      u => u.name.toLowerCase() === parsed.user.name.toLowerCase()
    );

    if (index !== -1) {
      const shouldReplace = await confirmReplace(parsed.user.name);
      if (!shouldReplace) return false;
      users[index] = parsed.user;
    } else {
      users.push(parsed.user);
    }

    this.storage.saveUsers(users);
    this.storage.saveSession(parsed.data.session);

    return true;
  }

  private async read(file: File): Promise<UserExport> {
    return JSON.parse(await file.text());
  }

  private validate(payload: UserExport): void {
    if (payload.app !== 'Quilix') throw new Error('Invalid Quilix backup.');
    if (payload.scope !== 'user') throw new Error('Invalid backup scope.');
  }
  
}
