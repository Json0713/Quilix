import { Routes } from '@angular/router';
import { QuilixAppStoreComponent } from '../../../shared/components/browser/quilix-app-store/quilix-app-store';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.TeamTemplate),
    children: [
      {
        path: '',
        data: { label: 'Home', icon: 'bi-house' },
        loadComponent: () => import('./index/index').then(m => m.TeamIndex)
      },
/*       {
        path: 'tasks',
        loadComponent: () => import('./tasks/tasks').then(m => m.TeamTasks)
      }, */
      {
        path: 'settings',
        data: { label: 'Settings', icon: 'bi-gear' },
        loadComponent: () => import('./settings/settings').then(m => m.TeamSettings)
      },
      {
        path: 'settings/data-management',
        data: { label: 'Data Management', icon: 'bi-database' },
        loadComponent: () => import('./settings/data-management/data-management').then(m => m.TeamDataManagement)
      },
      {
        path: 'store',
        data: { label: 'App Store', icon: 'bi-controller' },
        component: QuilixAppStoreComponent
      },
      {
        path: 'workspaces',
        data: { label: 'Workspaces', icon: 'bi-archive' },
        loadComponent: () => import('./workspaces/workspaces').then(m => m.TeamWorkspaces)
      },
      {
        path: 'trash',
        data: { label: 'Trash', icon: 'bi-trash3' },
        loadComponent: () => import('./trash/trash').then(m => m.TeamTrash)
      },
      {
        path: 'chat',
        data: { label: 'Chat', icon: 'bi-chat-dots' },
        loadComponent: () => import('./chat/chat').then(m => m.TeamChat)
      },
      {
        path: 'spaces/:spaceId',
        loadComponent: () => import('./space/space').then(m => m.TeamSpace)
      },
      {
        path: 'spaces/:spaceId/sheet/:sheetId',
        loadComponent: () => import('../shared/sheet-page/sheet-page').then(m => m.SheetPage)
      },
      {
        path: 'spaces/:spaceId/note/:noteId',
        loadComponent: () => import('../shared/note-page/note-page').then(m => m.NotePage)
      },
      {
        path: 'spaces/:spaceId/doc/:docId',
        loadComponent: () => import('../shared/doc-page/doc-page').then(m => m.DocPage)
      },
      {
        path: 'browse',
        data: { label: 'Browser', icon: 'bi-globe2' },
        loadComponent: () => import('../../../shared/components/browser/browser').then(m => m.BrowserComponent)
      },
      {
        path: '**',
        loadComponent: () => import('../../../shared/components/404/404').then(m => m.PageNotFound)
      }
    ]
  }
];
