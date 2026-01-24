import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { MetaAuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MetaAuthGuard implements CanActivate {

  constructor(
    private auth: MetaAuthService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const isLoggedIn = await this.auth.restoreSession();

    if (!isLoggedIn) {
      // Redirect to meta login page if not authenticated
      return this.router.createUrlTree(['/login']);
    }

    return true;
  }
}
