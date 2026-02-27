import { Routes } from '@angular/router';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.TeamTemplate),
    children: [
      {
        path: '',
        loadComponent: () => import('./index/index').then(m => m.TeamIndex)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./tasks/tasks').then(m => m.TeamTasks)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings').then(m => m.TeamSettings)
      },
      {
        path: 'workspaces',
        loadComponent: () => import('./workspaces/workspaces').then(m => m.TeamWorkspaces)
      },
      {
        path: 'trash',
        loadComponent: () => import('./trash/trash').then(m => m.TeamTrash)
      },
      {
        path: 'spaces/:spaceId',
        loadComponent: () => import('./space-view/space-view').then(m => m.SpaceView)
      }
    ]
  }
];
