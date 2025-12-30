import { Routes } from '@angular/router';
import { authGuard } from '../core/auth/auth.guard';
import { STUDENT_ROUTES } from './pages/student/student.routes';
import { TEACHER_ROUTES } from './pages/teacher/teacher.routes';
import { roleGuard } from '../core/guards/role-guard';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'student',
    canActivate: [authGuard, roleGuard('student')],
    children: STUDENT_ROUTES
  },
  {
    path: 'teacher',
    canActivate: [authGuard, roleGuard('teacher')],
    children: TEACHER_ROUTES
  }
];
