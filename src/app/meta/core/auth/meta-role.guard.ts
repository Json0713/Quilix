import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { MetaAuthService } from './auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Injectable({ providedIn: 'root' })
export class MetaRoleGuard implements CanActivate {

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}

    async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
        const requiredRole = route.data['role'] as MetaUserRole;

        const { data } = await this.auth.getCurrentUser();
        const user = data.user; // unwrap

        if (!user || user.user_metadata?.['role'] !== requiredRole) {
            return this.router.createUrlTree(['/']);
        }

        return true;
    }

}
