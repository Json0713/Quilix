export type WorkspaceRole = 'personal' | 'team';

export interface Workspace {
    id: string;
    name: string;
    role: WorkspaceRole;
    createdAt: number;
    lastActiveAt: number;
    order?: number;
    trashedAt?: number;
    folderPath?: string; // Optional reference to local folder
    isMissingOnDisk?: boolean; // Flagged when OS folder vanishes
}
