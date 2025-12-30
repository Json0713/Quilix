import { Routes } from '@angular/router';
import { StudentIndex } from './index/index';
import { StudentTemplate } from './template/template';

export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    component: StudentTemplate,
    children: [
      {
        path: '',
        component: StudentIndex
      }
      // future:
      // { path: 'tasks', component: StudentTasks }
    ]
  }
];
