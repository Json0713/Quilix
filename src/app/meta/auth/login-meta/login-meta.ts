import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MetaAuthService } from '../../core/auth/auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';


@Component({
  selector: 'app-login-meta',
  imports: [FormsModule],
  templateUrl: './login-meta.html',
  styleUrl: './login-meta.scss',
})
export class LoginMeta {

  email = '';
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

    const result = await this.auth.login(this.email, this.password);

    if (!result.success) {
      this.error = result.error ?? 'Login failed';
      this.loading = false;
      return;
    }

    const { data } = await this.auth.getCurrentUser();
    const role = data.user?.user_metadata?.['role'] as MetaUserRole;

    this.router.navigate([role === 'team' ? '/team' : '/personal']);
  }

}
