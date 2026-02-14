import { Routes } from '@angular/router';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.TeamTemplate),
    children: [
      {
        path: '',
        loadComponent: () => import('./index/index').then(m => m.TeamIndex)
      }
    ]
  }
];
