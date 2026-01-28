import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';

import { MetaProfileService } from '../auth/meta-profile.service';
import { MetaAuthService } from '../auth/meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Injectable({ providedIn: 'root' })
export class MetaRoleGuard implements CanActivate {

  constructor(
    private readonly auth: MetaAuthService,
    private readonly profiles: MetaProfileService,
    private readonly router: Router
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const requiredRole = route.data['role'] as MetaUserRole;

    // Ensure auth is ready
    const user = await this.auth.requireUser();
    if (!user) {
      return this.router.createUrlTree(['/meta/login']);
    }

    // Ensure profile is ready
    const profile = await this.profiles.requireProfile();
    if (!profile) {
      return this.router.createUrlTree(['/meta/login']);
    }

    // Role mismatch → redirect to safe landing
    if (profile.role !== requiredRole) {
      return this.router.createUrlTree([
        profile.role === 'team' ? '/meta/team' : '/meta/personal'
      ]);
    }

    return true;
  }
}
