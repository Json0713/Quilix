import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../storage/storage.key';
import { User } from '../interfaces/user';
import { Session } from '../interfaces/session';

@Injectable({
  providedIn: 'root',
})
export class Storage {

  private setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private getItem<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  clearAll(): void {
    localStorage.clear();
  }

  /* USER */

  saveUser(user: User): void {
    this.setItem<User>(STORAGE_KEYS.USER, user);
  }

  getUser(): User | null {
    return this.getItem<User>(STORAGE_KEYS.USER);
  }

  clearUser(): void {
    this.removeItem(STORAGE_KEYS.USER);
  }

  /* SESSION */

  saveSession(session: Session): void {
    this.setItem<Session>(STORAGE_KEYS.SESSION, session);
  }

  getSession(): Session | null {
    return this.getItem<Session>(STORAGE_KEYS.SESSION);
  }

  clearSession(): void {
    this.removeItem(STORAGE_KEYS.SESSION);
  }

}
