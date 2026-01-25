import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { MetaAuthService } from './meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';


@Injectable({ providedIn: 'root' })
export class MetaRoleGuard implements CanActivate {

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}
  
  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const requiredRole = route.data['role'] as MetaUserRole;

    const user = await this.auth.getCurrentUser(); // returns MetaUserProfile

    if (!user || user.role !== requiredRole) {
      return this.router.createUrlTree(['/']);
    }

    return true;
  }

}
