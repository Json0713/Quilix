import { Routes } from '@angular/router';

import { PersonalMeteTemplate } from './template/template';
import { PersonalMetaIndex } from './index/index';

export const PERSONAL_META_ROUTES: Routes = [
  {
    path: '',
    component: PersonalMeteTemplate,
    children: [
      {
        path: '',
        component: PersonalMetaIndex
      }
      // future:
      // { path: 'tasks', component: Personal Meta Tasks }
    ]
  }
];
