import { Routes } from '@angular/router';
import { AuthGuard } from '../core/auth/auth.guard';
import { STUDENT_ROUTES } from './pages/student/student.routes';
import { TEACHER_ROUTES } from './pages/teacher/teacher.routes';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'student',
    canActivate: [AuthGuard],
    children: STUDENT_ROUTES
  },
  {
    path: 'teacher',
    canActivate: [AuthGuard],
    children: TEACHER_ROUTES
  }
];
