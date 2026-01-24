import { Routes } from '@angular/router';

import { PersonalMeateTemplate } from './template/template';
import { PersonalMeataIndex } from './index/index';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    component: PersonalMeateTemplate,
    children: [
      {
        path: '',
        component: PersonalMeataIndex
      }
      // future:
      // { path: 'tasks', component: Personal Meta Tasks }
    ]
  }
];
