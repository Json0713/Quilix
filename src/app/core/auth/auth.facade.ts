import { Injectable } from '@angular/core';
import { Storage } from '../storage/storage';
import { User } from '../interfaces/user';
import { Session } from '../interfaces/session';


@Injectable({
  providedIn: 'root',
})
export class AuthFacade {


  constructor(private storage: Storage) {}

  /* USERS (LocalStorage) */
  getUsers(): User[] {
    return this.storage.getUsers();
  }

  getUserById(id: string): User | null {
    return this.storage.getUserById(id);
  }

  saveUsers(users: User[]): void {
    this.storage.saveUsers(users);
  }

  addUser(user: User): void {
    this.storage.addUser(user);
  }

  removeUser(userId: string): void {
    this.storage.removeUser(userId);
  }

  updateUserLastActive(userId: string): void {
    this.storage.updateUserLastActive(userId);
  }

  /* SESSION (LocalStorage) */
  saveSession(session: Session): void {
    this.storage.saveSession(session);
  }

  getSession(): Session | null {
    return this.storage.getSession();
  }

  clearSession(): void {
    this.storage.clearSession();
  }
  
}