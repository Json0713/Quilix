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
        loadComponent: () => import('../auth/workspace/recent-workspaces/recent-workspaces').then(m => m.RecentWorkspacesComponent)
      },
      {
        path: 'create-workspace',
        loadComponent: () => import('../auth/workspace/create-workspace/create-workspace').then(m => m.CreateWorkspaceComponent)
      }
    ]
  }
];
