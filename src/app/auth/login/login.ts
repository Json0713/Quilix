import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { User, UserRole } from '../../core/interfaces/user';
import { FormsModule } from '@angular/forms';
import { Spinner } from '../../shared/ui/spinner/spinner';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Spinner, DatePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  
  name = '';
  role: UserRole | null = null;
  users: User[] = [];
  deletingUserId: string | null = null;
  loadingUserId: string | null = null;
  errorMessage: string | null = null;
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.users = this.auth.getAllUsers();
  }

  createWorkspace(): void {
    if (this.name.trim().length < 2 || !this.role) return;

    this.loading = true;
    this.errorMessage = null;

    setTimeout(() => {
      const result = this.auth.createUser(this.name, this.role!);

      this.loading = false;

      if (!result.success) {
        this.errorMessage =
          result.error === 'DUPLICATE_NAME'
            ? 'This name already exists.'
            : 'Only one Student and one Teacher workspace are allowed.';
        return;
      }

      this.redirect(result.user!.role);
    }, 500);
  }

  continueWorkspace(user: User): void {
    this.auth.loginExisting(user);
    this.redirect(user.role);
  }

  deleteWorkspace(user: User): void {
    if (!confirm(`Delete workspace for "${user.name}"?`)) return;
    this.auth.deleteUser(user.id);
    this.users = this.auth.getAllUsers();
  }

  private redirect(role: UserRole): void {
    this.router.navigate([role === 'student' ? '/student' : '/teacher']);
  }

  //Delete User
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
      this.users = this.auth.getAllUsers();
      this.deletingUserId = null;
      this.loadingUserId = null;
    }, 600);
  }

  // UI
  getAvatarColor(userId: string): string {
    const colors = ['#3fbac2', '#6c8a8f', '#1a3a3f', '#244f55'];
    let hash = 0;

    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

}
