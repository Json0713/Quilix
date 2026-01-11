import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../interfaces/user';

export const roleGuard = (requiredRole: UserRole): CanActivateFn => {
  
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.getCurrentUser();

    if (user?.role !== requiredRole) {
      router.navigate(['/']);
      return false;
    }

    return true;
  };

};
