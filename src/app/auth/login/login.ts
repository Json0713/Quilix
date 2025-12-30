import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { User, UserRole } from '../../core/interfaces/user';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  
  name = '';
  role: UserRole | null = null;
  users: User[] = [];

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.users = this.auth.getAllUsers();
  }

  createWorkspace(): void {
    if (this.name.trim().length < 2 || !this.role) return;

    const user = this.auth.createUser(this.name, this.role);
    this.redirect(user.role);
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

}
