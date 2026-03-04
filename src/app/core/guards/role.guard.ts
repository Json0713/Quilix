import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { WorkspaceRole } from '../interfaces/workspace';

export const roleGuard = (requiredRole: WorkspaceRole): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const workspace = await auth.getCurrentWorkspace();

    if (!workspace) {
      router.navigate(['/login']);
      return false;
    }

    if (workspace.role !== requiredRole) {
      // Redirect to the correct role's route instead of /login
      // This prevents the login page flicker during cross-role workspace switches
      router.navigate([workspace.role === 'personal' ? '/personal' : '/team']);
      return false;
    }

    return true;
  };
};
