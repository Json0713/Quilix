export interface Session {
  isLoggedIn: boolean;
  userId: string | null;
  startedAt: number | null;
  lastActiveAt: number | null;
}
