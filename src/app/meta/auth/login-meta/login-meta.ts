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

  identifier = ''; // email OR phone
  password = '';
  error: string | null = null;
  loading = false;

  constructor(
    private auth: MetaAuthService,
    private profiles: MetaProfileService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const result = await this.auth.login(this.identifier, this.password);
      if (!result.success) {
        this.error = result.error ?? 'Login failed';
        return;
      }

      const profile = await this.profiles.getMyProfile();
      if (!profile) {
        this.error = 'Profile not found';
        return;
      }

      await this.router.navigate([
        profile.role === 'team' ? '/meta/team' : '/meta/personal'
      ]);
    } catch (e: any) {
      this.error = e.message ?? 'Unexpected error';
    } finally {
      this.loading = false;
    }
  }
}
