export interface Session {
  isLoggedIn: boolean;
  workspaceId: string | null;
  startedAt: number | null;
  lastActiveAt: number | null;
}
