import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { User, UserRole } from '../interfaces/user';
import { Session } from '../interfaces/session';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private storage: Storage) {}

  createUser(name: string, role: UserRole): CreateUserResult {
    const normalizedName = name.trim().toLowerCase();
    const users = this.storage.getUsers();

    if (users.some(u => u.name.toLowerCase() === normalizedName)) {
      return { success: false, error: 'DUPLICATE_NAME' };
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.storage.addUser(user);
    this.startSession(user.id);

    return { success: true, user };
  }

  loginExisting(user: User): void {
    this.startSession(user.id);
  }

  private startSession(userId: string): void {
    const now = Date.now();
    const session: Session = {
      isLoggedIn: true,
      userId,
      startedAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.storage.saveSession(session);
    this.storage.updateUserLastActive(userId);
  }

  getCurrentUser(): User | null {
    const session = this.storage.getSession();
    if (!session?.isLoggedIn || !session.userId) return null;
    return this.storage.getUserById(session.userId);
  }

  getAllUsers(): User[] {
    return this.storage
      .getUsers()
      .sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0));
  }

  restoreSession(): boolean {
    const user = this.getCurrentUser();

    if (!user) return false;

    this.storage.updateUserLastActive(user.id);
    return true;
  }

  hasRole(role: UserRole): boolean {
    return this.getCurrentUser()?.role === role;
  }

  logout(): void {
    this.storage.clearSession();
  }

  deleteUser(userId: string): void {
    this.storage.removeUser(userId);

    const session = this.storage.getSession();
    if (session?.userId === userId) {
      this.logout();
    }
  }
}

export interface CreateUserResult {
  success: boolean;
  error?: 'DUPLICATE_NAME';
  user?: User;
}
