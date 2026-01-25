import { MetaUserRole } from './meta-role';

export interface MetaUserProfile {
  id: string;
  username: string;
  role: MetaUserRole;
  email?: string;
  phone?: string;
  createdAt: string;
}
