import { Routes } from '@angular/router';
import { AuthGuard } from '../core/auth/auth.guard';
import { STUDENT_ROUTES } from './pages/student/student.routes';
import { TEACHER_ROUTES } from './pages/teacher/teacher.routes';
import { roleGuard } from '../core/guards/role-guard';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'student',
    canActivate: [AuthGuard, roleGuard('student')],
    children: STUDENT_ROUTES
  },
  {
    path: 'teacher',
    canActivate: [AuthGuard, roleGuard('teacher')],
    children: TEACHER_ROUTES
  }
];
