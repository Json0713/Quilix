import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MetaAuthService } from '../../core/auth/auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register-meta',
  imports: [FormsModule],
  templateUrl: './register-meta.html',
  styleUrl: './register-meta.scss',
})
export class RegisterMeta {
  email = '';
  password = '';
  role: MetaUserRole = 'personal';
  error: string | null = null;
  loading = false;

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    this.loading = true;
    this.error = null;

    const result = await this.auth.register(this.email, this.password, this.role);

    if (!result.success) {
      this.error = result.error ?? 'Registration failed';
      this.loading = false;
      return;
    }

    // Auto-login redirect
    this.router.navigate([this.role === 'team' ? '/team' : '/personal']);
  }

}
