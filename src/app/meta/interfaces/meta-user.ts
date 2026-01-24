import { MetaUserRole } from './meta-role';

export interface MetaUserProfile {
  id: string;
  email: string;
  role: MetaUserRole;
  createdAt: string;
}
