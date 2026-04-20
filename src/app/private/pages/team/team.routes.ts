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
/*       {
        path: 'tasks',
        loadComponent: () => import('./tasks/tasks').then(m => m.TeamTasks)
      }, */
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings').then(m => m.TeamSettings)
      },
      {
        path: 'settings/data-management',
        loadComponent: () => import('./settings/data-management/data-management').then(m => m.TeamDataManagement)
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
        path: 'chat',
        loadComponent: () => import('./chat/chat').then(m => m.TeamChat)
      },
      {
        path: 'spaces/:spaceId',
        loadComponent: () => import('./space/space').then(m => m.TeamSpace)
      }
    ]
  }
];
