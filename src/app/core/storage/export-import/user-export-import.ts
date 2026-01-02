import { Injectable } from '@angular/core';
import { Storage } from '../storage';
import { AuthService } from '../../auth/auth';
import { User } from '../../interfaces/user';
import { Session } from '../../interfaces/session';

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
    private auth: AuthService
  ) {}

  exportCurrentUser(): void {
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

    this.download(payload, `quilix-user-${user.name}`);
  }

  async importUser(
    file: File,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<void> {
    const parsed = await this.read(file);
    this.validate(parsed);

    const users = this.storage.getUsers();
    const index = users.findIndex(
      u => u.name.toLowerCase() === parsed.user.name.toLowerCase()
    );

    if (index !== -1) {
      const shouldReplace = await confirmReplace(parsed.user.name);
      if (!shouldReplace) return;
      users[index] = parsed.user;
    } else {
      users.push(parsed.user);
    }

    this.storage.saveUsers(users);
    this.storage.saveSession(parsed.data.session);
  }

  private async read(file: File): Promise<UserExport> {
    return JSON.parse(await file.text());
  }

  private validate(payload: UserExport): void {
    if (payload.app !== 'Quilix') throw new Error('Invalid Quilix file.');
    if (payload.scope !== 'user') throw new Error('Invalid scope.');
  }

  private download(payload: unknown, name: string): void {
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
}
