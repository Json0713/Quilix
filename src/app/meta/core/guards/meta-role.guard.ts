import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { MetaProfileService } from '../auth/meta-profile.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Injectable({ providedIn: 'root' })
export class MetaRoleGuard implements CanActivate {

  constructor(
    private profiles: MetaProfileService,
    private router: Router
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const requiredRole = route.data['role'] as MetaUserRole;

    try {
      const profile = await this.profiles.getMyProfile();

      if (!profile || profile.role !== requiredRole) {
        return this.router.createUrlTree(['/meta']);
      }

      return true;
    } catch {
      return this.router.createUrlTree(['/meta/login']);
    }
  }

}
