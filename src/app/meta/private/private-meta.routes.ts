import { Routes } from '@angular/router';

import { PERSONAL_META_ROUTES } from './pages/personal-meta/personal-meta.routes';
import { TEAM_META_ROUTES } from './pages/team-meta/team-meta.routes';
import { MetaRoleGuard } from '../core/guards/meta-role.guard';

export const PRIVATE_META_ROUTES: Routes = [

  {
    path: 'personal',
    canActivate: [MetaRoleGuard],
    data: { role: 'personal' },
    children: PERSONAL_META_ROUTES
  },
  {
    path: 'team',
    canActivate: [MetaRoleGuard],
    data: { role: 'team' },
    children: TEAM_META_ROUTES
  }

];
