export type TaskStatus = 'todo' | 'progress' | 'completed';

export interface Task {
    id: string;
    workspaceId: string;
    title: string;
    description: string;
    status: TaskStatus;
    order: number;
    createdAt: number;
    updatedAt: number;
    notesCount: number;
    imagesCount: number;
    filesCount: number;
}
