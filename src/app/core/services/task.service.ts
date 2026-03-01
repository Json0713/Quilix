import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../db/app-db';
import { Task, TaskStatus } from '../interfaces/task';
import { FileSystemService } from './file-system.service';

@Injectable({
    providedIn: 'root',
})
export class TaskService {
    private fileSystem = inject(FileSystemService);

    /**
     * Live-query observable of tasks for a workspace, ordered natively by index.
     */
    liveTasks$(workspaceId: string) {
        return liveQuery(async () => {
            return await db.tasks
                .where('workspaceId')
                .equals(workspaceId)
                .sortBy('order');
        });
    }

    /**
     * Create a new task globally in the database and optionally sync to OS.
     */
    async create(workspaceId: string, workspaceName: string, title: string, status: TaskStatus = 'todo'): Promise<Task> {
        // Find existing tasks to determine array appending order natively
        const existing = await db.tasks.where({ workspaceId, status }).toArray();
        const order = existing.length > 0 ? Math.max(...existing.map(t => t.order)) + 1 : 0;

        const task: Task = {
            id: crypto.randomUUID(),
            workspaceId,
            title,
            description: '',
            status,
            order,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            notesCount: 0,
            imagesCount: 0,
            filesCount: 0
        };

        await db.tasks.add(task);
        await this.syncToFileSystem(workspaceId, workspaceName);
        return task;
    }

    /**
     * Batch update sequential positioning and status from Drag & Drop.
     */
    async updateTaskOrders(orderedTasks: Task[], workspaceName: string): Promise<void> {
        const workspaceId = orderedTasks.length > 0 ? orderedTasks[0].workspaceId : null;

        // Inherit the exact physical DOM sequence out to Dexie
        await db.tasks.bulkPut(orderedTasks);

        if (workspaceId) {
            await this.syncToFileSystem(workspaceId, workspaceName);
        }
    }

    /**
     * Update a single task status organically.
     */
    async updateStatus(taskId: string, status: TaskStatus, workspaceName: string): Promise<boolean> {
        const task = await db.tasks.get(taskId);
        if (!task) return false;

        await db.tasks.update(taskId, { status, updatedAt: Date.now() });
        await this.syncToFileSystem(task.workspaceId, workspaceName);
        return true;
    }

    /**
     * Delete a task globally.
     */
    async permanentlyDelete(taskId: string, workspaceName: string): Promise<boolean> {
        const task = await db.tasks.get(taskId);
        if (!task) return false;

        await db.tasks.delete(taskId);
        await this.syncToFileSystem(task.workspaceId, workspaceName);
        return true;
    }

    /**
     * Synchronize IndexedDB task tables aggressively down into native `tasks.json`.
     */
    private async syncToFileSystem(workspaceId: string, workspaceName: string): Promise<void> {
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode !== 'filesystem') return;

        const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
        if (!wsHandle) return;

        try {
            const allTasks = await db.tasks.where('workspaceId').equals(workspaceId).sortBy('order');
            const fileHandle = await wsHandle.getFileHandle('tasks.json', { create: true });

            // Native File System API Writers
            const writable = await (fileHandle as any).createWritable();
            await writable.write(JSON.stringify(allTasks, null, 2));
            await writable.close();
        } catch (err) {
            console.error(`[TaskService] Hardware OS FileSystem failed to write tasks.json:`, err);
        }
    }
}
