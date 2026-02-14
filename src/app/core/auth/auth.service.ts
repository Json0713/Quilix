import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { User, UserRole } from '../interfaces/user';
import { UserService } from '../users/user.service';
import { db } from '../db/app-db';


@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private router = inject(Router);

  private readonly _authEvents = new Subject<'LOGIN' | 'LOGOUT'>();
  /** Observable of internal auth events (for sync service) */
  authEvents$ = this._authEvents.asObservable();

  constructor(
    private users: UserService
  ) { }

  async createUser(name: string, role: UserRole): Promise<CreateUserResult> {
    if (await this.users.existsByName(name)) {
      return { success: false, error: 'DUPLICATE_NAME' };
    }

    const user = await this.users.create(name, role);
    await this.startSession(user.id);
    await this.users.updateLastActive(user.id);

    return { success: true, user };
  }

  async loginExisting(user: User): Promise<void> {
    await this.startSession(user.id);
    await this.users.updateLastActive(user.id);
  }

  async getCurrentUser(): Promise<User | undefined> {
    const session = await this.getSession();
    if (!session?.isLoggedIn || !session.userId) return undefined;
    return this.users.getById(session.userId);
  }

  async restoreSession(): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user) return false;

    await this.users.updateLastActive(user.id);
    return true;
  }

  async hasRole(role: UserRole): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === role;
  }

  async logout(isExternalSync = false): Promise<void> {
    await db.sessions.clear();

    if (!isExternalSync) {
      this._authEvents.next('LOGOUT');
    }

    this.router.navigate(['/login']);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.users.delete(userId);

    const session = await this.getSession();
    if (session?.userId === userId) {
      await this.logout();
    }
  }

  // Session Helpers
  private async startSession(userId: string): Promise<void> {
    const now = Date.now();
    await db.sessions.clear();
    await db.sessions.put({
      userId,
      isLoggedIn: true,
      startedAt: now,
      lastActiveAt: now
    });

    this._authEvents.next('LOGIN');
  }

  private async getSession() {
    return db.sessions.toCollection().first();
  }
}

export interface CreateUserResult {
  success: boolean;
  error?: 'DUPLICATE_NAME';
  user?: User;
}
