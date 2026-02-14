import { Routes } from '@angular/router';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.PersonalTemplate),
    children: [
      {
        path: '',
        loadComponent: () => import('./index/index').then(m => m.PersonalIndex)
      }
    ]
  }
];
