import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { User, UserRole } from '../../core/interfaces/user';
import { FormsModule } from '@angular/forms';
import { Spinner } from '../../shared/ui/spinner/spinner';
import { DatePipe } from '@angular/common';
import { Header } from '../../public/common/header/header';
import { Footer } from '../../public/common/footer/footer';


@Component({
  selector: 'app-login',
  imports: [FormsModule, Spinner, DatePipe, Header , Footer],
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
    private router: Router
  ) {
    this.users = this.auth.getAllUsers();
  }

  ngOnInit() {
    this.loading = true;
    setTimeout(() => (this.loading = false), 1200);
  }

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
      this.isSubmitting = false;
    }, 1800);
  }

  continueWorkspace(user: User): void {
    if (this.loadingUserId) return;

    this.loadingUserId = user.id;

    setTimeout(() => {
      this.auth.loginExisting(user);
      this.redirect(user.role);
    }, 900);
  }

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
    }, 1200);
  }

  private redirect(role: UserRole): void {
    this.router.navigate([role === 'student' ? '/student' : '/teacher']);
  }

  getAvatarColor(userId: string): string {
    const colors = ['#dd791b', '#0a8ba1ff', '#c7cc37', '#a90fba', '#e30b5b'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

}
