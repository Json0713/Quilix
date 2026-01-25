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
  success: string | null = null;
  loading = false;

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    this.error = null;
    this.success = null;

    // Required fields
    if (!this.username || !this.password || !this.email) {
      this.error = 'Username, email, and password are required';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = 'Please enter a valid email address';
      return;
    }

    // Password strength (basic)
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters';
      return;
    }

    this.loading = true;

    const result = await this.auth.register(
      this.username,
      this.password,
      this.role,
      this.email,
      this.phone || undefined
    );

    this.loading = false;

    if (!result.success) {
      this.error = result.error ?? 'Registration failed';
      return;
    }

    // Registration successful
    this.success = 'Account created successfully. Please log in.';

    // Redirect after short delay for UX
    setTimeout(() => {
      this.router.navigate(['/meta/login']);
    }, 5200);
  }

}
