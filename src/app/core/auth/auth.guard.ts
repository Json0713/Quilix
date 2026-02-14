import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {

  const auth = inject(AuthService);
  const router = inject(Router);

  const currentUser = await auth.getCurrentUser();

  if (!currentUser) {
    router.navigate(['/login']); // Redirect to login page specifically
    return false;
  }

  return true;

};
