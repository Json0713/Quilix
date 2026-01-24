import { Routes } from '@angular/router';

import { TeamMetaTemplate } from './template/template';
import { TeamMetaIndex } from './index/index';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    component: TeamMetaTemplate,
    children: [
      {
        path: '',
        component: TeamMetaIndex
      }
      // future:
      // { path: 'tasks', component: Team Meta Tasks }
    ]
  }
];
