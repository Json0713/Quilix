import { Injectable } from '@angular/core';
import { AuthFacade } from '../auth/auth.facade';
import { User, UserRole } from '../interfaces/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  
  constructor(private storage: AuthFacade) {}

  getAll(): User[] {
    return this.storage
      .getUsers()
      .sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0));
  }

  getById(id: string): User | null {
    return this.storage.getUserById(id);
  }

  existsByName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return this.storage
      .getUsers()
      .some(u => u.name.toLowerCase() === normalized);
  }

  create(name: string, role: UserRole): User {
    const now = Date.now();

    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      createdAt: now,
      lastActiveAt: now,
    };

    this.storage.addUser(user);
    return user;
  }

  updateLastActive(userId: string): void {
    this.storage.updateUserLastActive(userId);
  }

  delete(userId: string): void {
    this.storage.removeUser(userId);
  }
  
}
