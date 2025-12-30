import { Routes } from '@angular/router';
import { TeacherTemplate } from './template/template';
import { TeacherIndex } from './index/index';

export const TEACHER_ROUTES: Routes = [
  {
    path: '',
    component: TeacherTemplate,
    children: [
      {
        path: '',
        component: TeacherIndex
      }
      // future:
      // { path: 'planner', component: TeacherPlanner }
    ]
  }
];
