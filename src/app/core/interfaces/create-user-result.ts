import { User } from "./user";

export interface CreateUserResult {
  success: boolean;
  error?: 'DUPLICATE_NAME' | 'DUPLICATE_ROLE';
  user?: User;
}
