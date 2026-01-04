import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { Session } from '../interfaces/session';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  constructor(private storage: Storage) {}

  start(userId: string): void {
    const now = Date.now();

    const session: Session = {
      isLoggedIn: true,
      userId,
      startedAt: now,
      lastActiveAt: now,
    };

    this.storage.saveSession(session);
  }

  get(): Session | null {
    return this.storage.getSession();
  }

  clear(): void {
    this.storage.clearSession();
  }
}
