import { Routes } from '@angular/router';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./template/template').then(m => m.PersonalTemplate),
    children: [
      {
        path: '',
        data: { label: 'Home', icon: 'bi-house' },
        loadComponent: () => import('./index/index').then(m => m.PersonalIndex)
      },
      /*       {
              path: 'tasks',
              loadComponent: () => import('./tasks/tasks').then(m => m.PersonalTasks)
            }, */
      {
        path: 'settings',
        data: { label: 'Settings', icon: 'bi-gear' },
        loadComponent: () => import('./settings/settings').then(m => m.PersonalSettings)
      },
      {
        path: 'settings/data-management',
        data: { label: 'Data Management', icon: 'bi-database' },
        loadComponent: () => import('./settings/data-management/data-management').then(m => m.PersonalDataManagement)
      },
      {
        path: 'workspaces',
        data: { label: 'Workspaces', icon: 'bi-archive' },
        loadComponent: () => import('./workspaces/workspaces').then(m => m.PersonalWorkspaces)
      },
      {
        path: 'trash',
        data: { label: 'Trash', icon: 'bi-trash3' },
        loadComponent: () => import('./trash/trash').then(m => m.PersonalTrash)
      },
      {
        path: 'chat',
        data: { label: 'Chat', icon: 'bi-chat-dots' },
        loadComponent: () => import('./chat/chat').then(m => m.PersonalChat)
      },
      {
        path: 'spaces/:spaceId',
        loadComponent: () => import('./space/space').then(m => m.PersonalSpace)
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
