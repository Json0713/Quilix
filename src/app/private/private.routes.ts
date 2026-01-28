import { Routes } from '@angular/router';

import { authGuard } from '../core/auth/auth.guard';
import { roleGuard } from '../core/guards/role.guard';

import { PERSONAL_ROUTES } from './pages/personal/personal.routes';
import { TEAM_ROUTES } from './pages/team/team.routes';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'personal',
    canActivate: [authGuard, roleGuard('personal')],
    children: PERSONAL_ROUTES
  },
  {
    path: 'team',
    canActivate: [authGuard, roleGuard('team')],
    children: TEAM_ROUTES
  }
];
