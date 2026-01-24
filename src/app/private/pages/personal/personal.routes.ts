import { Routes } from '@angular/router';

import { PersonalTemplate } from './template/template';
import { PersonalIndex } from './index/index';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    component: PersonalTemplate,
    children: [
      {
        path: '',
        component: PersonalIndex
      }
      // future:
      // { path: 'tasks', component: PersonalTasks }
    ]
  }
];
