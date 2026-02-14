import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../storage/storage.key';
import { Workspace } from '../interfaces/workspace';
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

  /* WORKSPACES */
  getWorkspaces(): Workspace[] {
    return this.getItem<Workspace[]>(STORAGE_KEYS.WORKSPACES) ?? [];
  }

  saveWorkspaces(workspaces: Workspace[]): void {
    this.setItem(STORAGE_KEYS.WORKSPACES, workspaces);
  }

  addWorkspace(workspace: Workspace): void {
    const workspaces = this.getWorkspaces();
    this.saveWorkspaces([...workspaces, workspace]);
  }

  removeWorkspace(workspaceId: string): void {
    const workspaces = this.getWorkspaces().filter(w => w.id !== workspaceId);
    this.saveWorkspaces(workspaces);
  }

  getWorkspaceById(id: string): Workspace | null {
    return this.getWorkspaces().find(w => w.id === id) ?? null;
  }

  /* Last Active */
  updateWorkspaceLastActive(workspaceId: string): void {
    const workspaces = this.getWorkspaces().map(workspace =>
      workspace.id === workspaceId
        ? { ...workspace, lastActiveAt: Date.now() }
        : workspace
    );

    this.saveWorkspaces(workspaces);
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
