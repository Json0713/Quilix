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
  email = '';
  password = '';
  phone = '';
  role: MetaUserRole = 'personal';

  error: string | null = null;
  loading = false;

  constructor(
    private readonly auth: MetaAuthService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.loading) return;

    this.error = null;

    if (!this.username || !this.email || !this.password) {
      this.error = 'Username, email, and password are required';
      return;
    }

    this.loading = true;

    const result = await this.auth.register(
      this.email,
      this.password,
      {
        username: this.username.trim(),
        role: this.role,
        phone: this.phone?.trim() || undefined
      }
    );

    this.loading = false;

    if (!result.success) {
      this.error = result.error ?? 'Registration failed';
      return;
    }

    await this.router.navigate(['/meta/login'], {
      queryParams: { registered: '1' }
    });
  }

}
