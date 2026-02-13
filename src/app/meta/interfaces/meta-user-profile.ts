import { MetaUserRole } from './meta-role';

export interface MetaUserProfile {
  id: string;
  username: string;
  role: MetaUserRole;
  phone?: string;
  createdAt: string;
}
