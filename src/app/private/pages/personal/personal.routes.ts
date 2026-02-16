import { Routes } from '@angular/router';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.PersonalTemplate),
    children: [
      {
        path: '',
        loadComponent: () => import('./index/index').then(m => m.PersonalIndex)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./tasks/tasks').then(m => m.PersonalTasks)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings').then(m => m.PersonalSettings)
      }
    ]
  }
];
