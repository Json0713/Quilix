import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { MetaAuthService } from '../auth/meta-auth.service';

@Injectable({ providedIn: 'root' })
export class MetaAuthGuard implements CanActivate {

  constructor(
    private readonly auth: MetaAuthService,
    private readonly router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const user = await this.auth.requireUser();

    if (!user) {
      return this.router.createUrlTree(['/meta/login']);
    }

    return true;
  }
}
