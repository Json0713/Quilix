export type UserRole = 'student' | 'teacher';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: number;
  lastActiveAt: number;
}
