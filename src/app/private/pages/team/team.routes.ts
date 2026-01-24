import { Routes } from '@angular/router';

import { TeamTemplate } from './template/template';
import { TeamIndex } from './index/index';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    component: TeamTemplate,
    children: [
      {
        path: '',
        component: TeamIndex
      }
      // future:
      // { path: 'tasks', component: TeamTasks }
    ]
  }
];
