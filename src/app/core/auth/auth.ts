import { Injectable } from '@angular/core';
import { User, UserRole } from '../interfaces/user';
import { UserService } from '../users/user.service';
import { SessionService } from '../session/session.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private users: UserService,
    private sessions: SessionService
  ) {}

  createUser(name: string, role: UserRole): CreateUserResult {
    if (this.users.existsByName(name)) {
      return { success: false, error: 'DUPLICATE_NAME' };
    }

    const user = this.users.create(name, role);
    this.sessions.start(user.id);
    this.users.updateLastActive(user.id);

    return { success: true, user };
  }

  loginExisting(user: User): void {
    this.sessions.start(user.id);
    this.users.updateLastActive(user.id);
  }

  getCurrentUser(): User | null {
    const session = this.sessions.get();
    if (!session?.isLoggedIn || !session.userId) return null;
    return this.users.getById(session.userId);
  }

  restoreSession(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    this.users.updateLastActive(user.id);
    return true;
  }

  hasRole(role: UserRole): boolean {
    return this.getCurrentUser()?.role === role;
  }

  logout(): void {
    this.sessions.clear();
  }

  deleteUser(userId: string): void {
    this.users.delete(userId);

    const session = this.sessions.get();
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