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
    return raw ? JSON.parse(raw) as T : null;
  }

  private removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /* USERS */
  getUsers(): User[] {
    return this.getItem<User[]>(STORAGE_KEYS.USERS) ?? [];
  }

  saveUsers(users: User[]): void {
    this.setItem(STORAGE_KEYS.USERS, users);
  }

  addUser(user: User): void {
    const users = this.getUsers();
    if (users.some(u => u.name === user.name)) return;
    this.saveUsers([...users, user]);
  }

  removeUser(userId: string): void {
    const users = this.getUsers().filter(u => u.id !== userId);
    this.saveUsers(users);
  }

  getUserById(id: string): User | null {
    return this.getUsers().find(u => u.id === id) ?? null;
  }

  /* SESSION */
  saveSession(session: Session): void {
    this.setItem(STORAGE_KEYS.SESSION, session);
  }

  getSession(): Session | null {
    return this.getItem<Session>(STORAGE_KEYS.SESSION);
  }

  clearSession(): void {
    this.removeItem(STORAGE_KEYS.SESSION);
  }

}
