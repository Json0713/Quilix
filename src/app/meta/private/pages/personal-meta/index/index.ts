import { Component } from '@angular/core';
import { MetaAuthService } from '../../../../core/auth/meta-auth.service';
import { Router } from '@angular/router';
import { MetaProfileService } from '../../../../core/auth/meta-profile.service';

@Component({
  selector: 'personal-meta-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalMetaIndex {

  loading = false;

  constructor(
    private readonly auth: MetaAuthService,
    private readonly profiles: MetaProfileService, // <-- inject
    private readonly router: Router
  ) {}

  async logout(): Promise<void> {
    if (this.loading) return;

    this.loading = true;

    try {
      await this.auth.logout();          // Supabase signOut
      this.profiles.clear();             // Clear cached profile
      await this.router.navigate(['/meta/login']);
    } finally {
      this.loading = false;
    }
  }
}
