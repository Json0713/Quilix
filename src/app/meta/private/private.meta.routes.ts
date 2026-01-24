import { Routes } from '@angular/router';

import { PERSONAL_META_ROUTES } from './pages/personal-meta/personal-meta.routes';
import { TEAM_META_ROUTES } from './pages/team-meta/team-meta.routes';

export const PRIVATE_META_ROUTES: Routes = [

  {
    path: 'personal',
    // canActivate: [authGuard, roleGuard('personal-meta')],
    children: PERSONAL_META_ROUTES
  },
  
  {
    path: 'team',
    // canActivate: [authGuard, roleGuard('team-meta')],
    children: TEAM_META_ROUTES
  }

];
