import { Component, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { MetaAuthService } from '../../../../core/auth/meta-auth.service';
import { MetaProfileService } from '../../../../core/auth/meta-profile.service';
import { Valentines } from "../../../../../public/valentines/valentines";

@Component({
  selector: 'team-meta-index',
  imports: [RouterModule, Valentines],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamMetaIndex {

  loading = false;

  // Reactive State
  readonly username = computed(
    () => this.profiles.profile()?.username ?? ''
  );

  constructor(
    private readonly auth: MetaAuthService,
    private readonly profiles: MetaProfileService,
    private readonly router: Router
  ) {}

  async logout(): Promise<void> {
    if (this.loading) return;

    this.loading = true;

    try {
      await this.auth.logout(); // Supabase signOut
      this.profiles.clear();    // Clear cached profile
      await this.router.navigate(['/meta/login']);
    } finally {
      this.loading = false;
    }
  }

}
