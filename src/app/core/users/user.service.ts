import { Injectable } from '@angular/core';
import { liveQuery, Observable } from 'dexie';
import { db } from '../db/app-db';
import { User, UserRole } from '../interfaces/user';


@Injectable({
  providedIn: 'root',
})
export class UserService {

  // Real-time observable of users, sorted by lastActiveAt
  readonly users$ = liveQuery(() =>
    db.users.orderBy('lastActiveAt').reverse().toArray()
  );

  async getAll(): Promise<User[]> {
    return db.users.orderBy('lastActiveAt').reverse().toArray();
  }

  async getById(id: string): Promise<User | undefined> {
    return db.users.get(id);
  }

  async existsByName(name: string): Promise<boolean> {
    const normalized = name.trim().toLowerCase();

    // Dexie doesn't verify case-insensitivity by default with simple indexes,
    // so we fetch all to check. For small datasets this is fine.
    // For larger, we'd store a normalizedName field.
    const all = await db.users.toArray();
    return all.some(u => u.name.toLowerCase() === normalized);
  }

  async create(name: string, role: UserRole): Promise<User> {
    const now = Date.now();

    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      createdAt: now,
      lastActiveAt: now,
    };

    await db.users.add(user);
    return user;
  }

  async updateLastActive(userId: string): Promise<void> {
    await db.users.update(userId, { lastActiveAt: Date.now() });
  }

  async delete(userId: string): Promise<void> {
    await db.users.delete(userId);
  }

}
