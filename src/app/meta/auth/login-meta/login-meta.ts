import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MetaAuthService } from '../../core/auth/meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Component({
  selector: 'app-login-meta',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login-meta.html',
  styleUrls: ['./login-meta.scss'],
})
export class LoginMeta {

  identifier = '';
  password = '';
  error: string | null = null;
  loading = false;

  constructor(
    private auth: MetaAuthService,
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

      const user = await this.auth.getCurrentUser();
      if (!user) {
        this.error = 'User not found';
        return;
      }

      await this.router.navigate([
        user.role === 'team' ? '/meta/team' : '/meta/personal'
      ]);
    } catch (err: any) {
      this.error = err?.message ?? 'Unexpected error';
    } finally {
      this.loading = false;
    }
  }

}
