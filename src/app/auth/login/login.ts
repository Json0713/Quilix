import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
export class Login {

  name = '';
  role: UserRole | null = null;

  users: User[] = [];

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
    this.users = this.usersService.getAll();
    this.toastRelay.consume();
  } 

  ngOnInit(): void {
    this.loading = true;
    setTimeout(() => (this.loading = false), 1200);
  }

  private redirect(role: UserRole): void {
    this.router.navigate([role === 'student' ? '/student' : '/teacher']);
  }

  /* Workspace Creation */
  createWorkspace(): void {
    if (this.name.trim().length < 2 || !this.role || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = null;

    const result = this.auth.createUser(this.name, this.role);

    if (!result.success) {
      this.isSubmitting = false;

      if (result.error === 'DUPLICATE_NAME') {
        this.errorMessage = 'A workspace with this name already exists.';
      }
      return;
    }

    setTimeout(() => {
      this.redirect(result.user!.role);

      // User flag to notify
      localStorage.setItem('justLoggedIn', 'true');

      this.isSubmitting = false;
    }, 1800);
  }

  /* Workspace Login */
  continueWorkspace(user: User): void {
    if (this.loadingUserId) return;

    this.loadingUserId = user.id;

    setTimeout(() => {
      this.auth.loginExisting(user);
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

    setTimeout(() => {
      this.auth.deleteUser(user.id);
      this.users = this.usersService.getAll();
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
