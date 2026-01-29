import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MetaAuthService } from '../../core/auth/meta-auth.service';
import { MetaProfileService } from '../../core/auth/meta-profile.service';

@Component({
  selector: 'app-login-meta',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login-meta.html',
  styleUrls: ['./login-meta.scss'],
})
export class LoginMeta {

  email = '';
  password = '';

  error: string | null = null;
  loading = false;

  constructor(
    private readonly auth: MetaAuthService,
    private readonly profiles: MetaProfileService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.loading) return;

    this.error = null;

    if (!this.email || !this.password) {
      this.error = 'Email and password are required';
      return;
    }

    this.loading = true;

    const result = await this.auth.login(this.email, this.password);

    if (!result.success) {
      this.loading = false;
      this.error = result.error ?? 'Login failed';
      return;
    }

    const profile = await this.profiles.requireProfile();

    if (!profile) {
      this.loading = false;
      this.error = 'Profile not found';
      return;
    }

    await this.router.navigate([
      profile.role === 'team' ? '/meta/team' : '/meta/personal'
    ], 
      { replaceUrl: true } 
    );
  }

}
