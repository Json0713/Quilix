import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { User, UserRole } from '../interfaces/user';
import { Session } from '../interfaces/session';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private storage: Storage) {}

  createUser(name: string, role: UserRole): User {
    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      createdAt: Date.now()
    };

    this.storage.addUser(user);
    this.startSession(user.id);

    return user;
  }

  loginExisting(user: User): void {
    this.startSession(user.id);
  }

  private startSession(userId: string): void {
    const session: Session = {
      isLoggedIn: true,
      userId,
      startedAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.storage.saveSession(session);
  }

  getCurrentUser(): User | null {
    const session = this.storage.getSession();
    if (!session?.isLoggedIn || !session.userId) return null;
    return this.storage.getUserById(session.userId);
  }

  getAllUsers(): User[] {
    return this.storage.getUsers();
  }

  restoreSession(): boolean {
    return !!this.getCurrentUser();
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
