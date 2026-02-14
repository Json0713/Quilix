import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.PublicTemplate),
    children: [
      {
        path: '',
        loadComponent: () => import('./index/index').then(m => m.PublicIndex)
      },
      {
        path: 'login',
        loadComponent: () => import('../auth/login/login').then(m => m.Login)
      }
    ]
  }
];
