import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { User, UserRole } from '../interfaces/user';
import { Session } from '../interfaces/session';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(private storage: Storage) {}

  login(name: string, role: UserRole): User {
    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      createdAt: Date.now()
    };

    const session: Session = {
      isLoggedIn: true,
      userId: user.id,
      startedAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.storage.saveUser(user);
    this.storage.saveSession(session);

    return user;
  }

  logout(): void {
    this.storage.clearSession();
  }

  isLoggedIn(): boolean {
    const session = this.storage.getSession();
    return !!session?.isLoggedIn;
  }

  getCurrentUser(): User | null {
    const session = this.storage.getSession();
    if (!session?.isLoggedIn || !session.userId) return null;

    const user = this.storage.getUser();
    if (!user || user.id !== session.userId) return null;

    return user;
  }

  restoreSession(): boolean {
    const session = this.storage.getSession();
    const user = this.storage.getUser();

    if (!session || !user) return false;
    if (!session.isLoggedIn) return false;
    if (session.userId !== user.id) return false;

    return true;
  }
}
