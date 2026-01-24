export type UserRole = 'personal' | 'team';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: number;
  lastActiveAt: number;
}
