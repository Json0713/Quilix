import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceService } from '../../core/workspaces/workspace.service';

import { Workspace, WorkspaceRole } from '../../core/interfaces/workspace';

import { Spinner } from '../../shared/ui/common/spinner/spinner';
import { TimeAgoPipe } from '../../shared/ui/common/time-ago/time-ago-pipe';

import { ToastRelayService } from '../../services/ui/common/toast/toast-relay';
import { ModalService } from '../../services/ui/common/modal/modal';


@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterModule, Spinner, TimeAgoPipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {

  name = '';
  role: WorkspaceRole | null = null;

  workspaces: Workspace[] = [];
  /** Subscription to Dexie live query. Using 'any' to avoid complex type mismatch with Dexie's Observable. */
  private workspacesSub: any;

  deletingWorkspaceId: string | null = null;
  loadingWorkspaceId: string | null = null;

  /** 
   * Tracks IDs present BEFORE a creation starts to prevent flickering
   * of the newly created workspace in the "Recent" list.
   */
  private snapshotWorkspaceIds: Set<string> = new Set();

  isSubmitting = false;
  errorMessage: string | null = null;
  loading = false;

  constructor(
    private auth: AuthService,
    private workspaceService: WorkspaceService,
    private router: Router,
    private toastRelay: ToastRelayService,
    private modal: ModalService
  ) {
    this.toastRelay.consume();
  }

  ngOnInit(): void {
    this.loading = true;

    // Subscribe to live query from Dexie
    this.workspacesSub = this.workspaceService.workspaces$.subscribe(
      (list: Workspace[]) => {
        // While submitting, we "freeze" the view to the workspaces we knew about.
        // This prevents the new workspace from flickering on/off during the delay.
        if (this.isSubmitting) {
          this.workspaces = list.filter(w => this.snapshotWorkspaceIds.has(w.id));
        } else {
          this.workspaces = list;
        }
        this.loading = false;
      }
    );
  }

  ngOnDestroy(): void {
    this.workspacesSub?.unsubscribe();
  }

  private redirect(role: WorkspaceRole): void {
    this.router.navigate([role === 'personal' ? '/personal' : '/team']);
  }

  /**
   * Creates a new local workspace (technical user profile)
   */
  async createWorkspace(): Promise<void> {
    if (this.name.trim().length < 2 || !this.role || this.isSubmitting) return;

    // CAPTURE SNAPSHOT: Set current IDs to prevent flickering before DB write
    this.snapshotWorkspaceIds = new Set(this.workspaces.map(w => w.id));
    this.isSubmitting = true;
    this.errorMessage = null;

    const result = await this.auth.createWorkspace(this.name, this.role);

    if (!result.success) {
      this.isSubmitting = false;
      this.snapshotWorkspaceIds.clear();

      if (result.error === 'DUPLICATE_NAME') {
        this.errorMessage = 'A workspace with this name already exists.';
      }
      return;
    }

    // UX Delay for "Preparing Workspace" feel
    setTimeout(() => {
      // User flag to notify
      localStorage.setItem('justLoggedIn', 'true');

      this.redirect(result.workspace!.role);

      this.isSubmitting = false;
      this.snapshotWorkspaceIds.clear();
    }, 1800);
  }

  /**
   * Resumes an existing local workspace
   */
  async continueWorkspace(workspace: Workspace): Promise<void> {
    if (this.loadingWorkspaceId) return;

    this.loadingWorkspaceId = workspace.id;

    // Simulate load delay for UX
    setTimeout(async () => {
      await this.auth.loginExisting(workspace);

      localStorage.setItem('justLoggedIn', 'true');

      this.redirect(workspace.role);
      this.loadingWorkspaceId = null;
    }, 1500); // Slightly faster for existing ones
  }

  /* Workspace Deletion */
  requestDelete(workspace: Workspace): void {
    this.deletingWorkspaceId = workspace.id;
  }

  cancelDelete(): void {
    this.deletingWorkspaceId = null;
  }

  confirmDelete(workspace: Workspace): void {
    this.loadingWorkspaceId = workspace.id;

    setTimeout(async () => {
      await this.auth.deleteWorkspace(workspace.id);

      this.deletingWorkspaceId = null;
      this.loadingWorkspaceId = null;
    }, 1200);
  }

  /* UI Helpers */
  getAvatarColor(workspaceId: string): string {
    const colors = [
      '#4fa3a8', // teal
      '#6b8e23', // olive
      '#c0841a', // amber
      '#8b5a9a', // plum
      '#a76d5c', // clay
      '#3f6c7a', // slate teal
    ];

    let hash = 0;
    for (let i = 0; i < workspaceId.length; i++) {
      hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  openImport(): void {
    this.modal.openImport();
  }

}
