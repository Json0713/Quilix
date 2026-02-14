import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { WorkspaceRole } from '../interfaces/workspace';

export const roleGuard = (requiredRole: WorkspaceRole): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const workspace = await auth.getCurrentWorkspace();

    if (workspace?.role !== requiredRole) {
      router.navigate(['/login']);
      return false;
    }

    return true;
  };
};
