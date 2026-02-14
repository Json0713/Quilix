import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Workspace, WorkspaceRole } from '../interfaces/workspace';
import { WorkspaceService } from '../workspaces/workspace.service';
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
    private workspaces: WorkspaceService
  ) { }

  async createWorkspace(name: string, role: WorkspaceRole): Promise<CreateWorkspaceResult> {
    if (await this.workspaces.existsByName(name)) {
      return { success: false, error: 'DUPLICATE_NAME' };
    }

    const workspace = await this.workspaces.create(name, role);
    await this.startSession(workspace.id);
    await this.workspaces.updateLastActive(workspace.id);

    return { success: true, workspace };
  }

  async loginExisting(workspace: Workspace): Promise<void> {
    await this.startSession(workspace.id);
    await this.workspaces.updateLastActive(workspace.id);
  }

  async getCurrentWorkspace(): Promise<Workspace | undefined> {
    const session = await this.getSession();
    if (!session?.isLoggedIn || !session.workspaceId) return undefined;
    return this.workspaces.getById(session.workspaceId);
  }

  async restoreSession(): Promise<boolean> {
    const workspace = await this.getCurrentWorkspace();
    if (!workspace) return false;

    await this.workspaces.updateLastActive(workspace.id);
    return true;
  }

  async hasRole(role: WorkspaceRole): Promise<boolean> {
    const workspace = await this.getCurrentWorkspace();
    return workspace?.role === role;
  }

  async logout(isExternalSync = false): Promise<void> {
    await db.sessions.clear();

    if (!isExternalSync) {
      this._authEvents.next('LOGOUT');
    }

    this.router.navigate(['/login']);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.workspaces.delete(workspaceId);

    const session = await this.getSession();
    if (session?.workspaceId === workspaceId) {
      await this.logout();
    }
  }

  // Session Helpers
  private async startSession(workspaceId: string): Promise<void> {
    const now = Date.now();
    await db.sessions.clear();
    await db.sessions.put({
      workspaceId,
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

export interface CreateWorkspaceResult {
  success: boolean;
  error?: 'DUPLICATE_NAME';
  workspace?: Workspace;
}
