// src/app/meta/auth/register-meta/register-meta.ts
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MetaAuthService } from '../../core/auth/meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Component({
  selector: 'app-register-meta',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register-meta.html',
  styleUrls: ['./register-meta.scss'],
})
export class RegisterMeta {
  
  username = '';
  password = '';
  role: MetaUserRole = 'personal';
  email = '';
  phone = '';
  error: string | null = null;
  loading = true;

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    if (!this.username || !this.password) {
      this.error = 'Username and password are required';
      return;
    }

    this.loading = true;
    this.error = null;

    const result = await this.auth.register(
      this.username,
      this.password,
      this.role,
      this.email || undefined,
      this.phone || undefined
    );

    if (!result.success) {
      this.error = result.error ?? 'Registration failed';
      this.loading = false;
      return;
    }

    const loginResult = await this.auth.login(this.username, this.password);

    if (!loginResult.success) {
      this.error = loginResult.error ?? 'Auto-login failed';
      this.loading = false;
      return;
    }

    this.loading = false;
    this.router.navigate([this.role === 'team' ? '/team' : '/personal']);
  }

}
