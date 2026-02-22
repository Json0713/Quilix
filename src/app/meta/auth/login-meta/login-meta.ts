import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { MetaAuthService } from '../../core/auth/meta-auth.service';
import { MetaProfileService } from '../../core/auth/meta-profile.service';
import { LoginMockupComponent } from '../login-mockup/login-mockup';

@Component({
  selector: 'app-login-meta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LoginMockupComponent],
  templateUrl: './login-meta.html',
  styleUrls: ['./login-meta.scss'],
})
export class LoginMeta {

  loginForm: FormGroup;
  error: string | null = null;
  loading = false;
  showPassword = false;

  constructor(
    private readonly auth: MetaAuthService,
    private readonly profiles: MetaProfileService,
    private readonly router: Router,
    private readonly fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  get f() { return this.loginForm.controls; }

  async submit(): Promise<void> {
    if (this.loginForm.invalid || this.loading) return;

    this.loading = true;
    this.error = null;

    const { email, password } = this.loginForm.getRawValue();

    const result = await this.auth.login(email, password);

    if (!result.success) {
      this.loading = false;
      this.error = result.error ?? 'Login failed';
      return;
    }

    try {
      const profile = await this.profiles.requireProfile();

      if (!profile) {
        this.loading = false;
        this.error = 'Profile not found. Please contact support.';
        return;
      }

      await this.router.navigate([
        profile.role === 'team' ? '/meta/team' : '/meta/personal'
      ],
        { replaceUrl: true }
      );
    } catch (err) {
      console.error('Profile fetch error:', err);
      this.loading = false;
      this.error = 'Failed to load user profile.';
    }
  }

}
