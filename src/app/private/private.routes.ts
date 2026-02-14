import { Routes } from '@angular/router';

import { authGuard } from '../core/auth/auth.guard';
import { roleGuard } from '../core/guards/role.guard';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'personal',
    canActivate: [authGuard, roleGuard('personal')],
    loadChildren: () => import('./pages/personal/personal.routes').then(m => m.PERSONAL_ROUTES)
  },
  {
    path: 'team',
    canActivate: [authGuard, roleGuard('team')],
    loadChildren: () => import('./pages/team/team.routes').then(m => m.TEAM_ROUTES)
  }
];
