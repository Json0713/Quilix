export interface Space {
    id: string;
    workspaceId: string;
    name: string;
    folderName: string;
    createdAt: number;
    order: number;
    trashedAt?: number;
}
