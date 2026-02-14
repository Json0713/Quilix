import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../core/users/user.service';

import { User, UserRole } from '../../core/interfaces/user';

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
  role: UserRole | null = null;

  users: User[] = [];
  usersSub: any;

  deletingUserId: string | null = null;
  loadingUserId: string | null = null;

  isSubmitting = false;
  errorMessage: string | null = null;
  loading = false;

  constructor(
    private auth: AuthService,
    private usersService: UserService,
    private router: Router,
    private toastRelay: ToastRelayService,
    private modal: ModalService
  ) {
    this.toastRelay.consume();
  }

  ngOnInit(): void {
    this.loading = true;

    // Subscribe to live query from Dexie
    this.usersSub = this.usersService.users$.subscribe(
      (users) => {
        this.users = users;
        this.loading = false; // Data loaded
      }
    );
  }

  ngOnDestroy(): void {
    this.usersSub?.unsubscribe();
  }

  private redirect(role: UserRole): void {
    this.router.navigate([role === 'personal' ? '/personal' : '/team']);
  }

  /* Workspace Creation */
  async createWorkspace(): Promise<void> {
    if (this.name.trim().length < 2 || !this.role || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = null;

    const result = await this.auth.createUser(this.name, this.role);

    if (!result.success) {
      this.isSubmitting = false;

      if (result.error === 'DUPLICATE_NAME') {
        this.errorMessage = 'A workspace with this name already exists.';
      }
      return;
    }

    // Give a small delay for UI feedback if desired, or redirect immediately
    setTimeout(() => {
      this.redirect(result.user!.role);

      // User flag to notify
      localStorage.setItem('justLoggedIn', 'true');

      this.isSubmitting = false;
    }, 1800);
  }

  /* Workspace Login */
  async continueWorkspace(user: User): Promise<void> {
    if (this.loadingUserId) return;

    this.loadingUserId = user.id;

    // Simulate load delay for UX if desired
    setTimeout(async () => {
      await this.auth.loginExisting(user);
      this.redirect(user.role);

      // User flag to notify
      localStorage.setItem('justLoggedIn', 'true');

      this.loadingUserId = null;
    }, 1900);
  }

  /* Workspace Deletion */
  requestDelete(user: User): void {
    this.deletingUserId = user.id;
  }

  cancelDelete(): void {
    this.deletingUserId = null;
  }

  confirmDelete(user: User): void {
    this.loadingUserId = user.id;

    setTimeout(async () => {
      await this.auth.deleteUser(user.id);
      // Logic for refreshing list is handled automatically by users$ subscription

      this.deletingUserId = null;
      this.loadingUserId = null;
    }, 1200);
  }

  /* Avatar */
  getAvatarColor(userId: string): string {
    const colors = [
      '#4fa3a8', // teal
      '#6b8e23', // olive
      '#c0841a', // amber
      '#8b5a9a', // plum
      '#a76d5c', // clay
      '#3f6c7a', // slate teal
    ];

    let hash = 0;

    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /* Import */
  openImport(): void {
    this.modal.openImport();
  }

}
