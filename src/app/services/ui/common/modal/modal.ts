import { Injectable, signal } from '@angular/core';
import { ModalConfig } from '../../../../shared/ui/common/modal/modal.model';
import { Task } from '../../../../core/interfaces/task';
import { Workspace } from '../../../../core/interfaces/workspace';
import { FileExplorerEntry } from '../../../../core/services/components/file-manager.service';

@Injectable({
  providedIn: 'root',
})
export class ModalService {

  private readonly _modal = signal<ModalConfig | null>(null);
  private id = 0;

  readonly modal = this._modal.asReadonly();

  /** Prevent memory leaks by cleanly resolving any dangling open promise before overwriting */
  private _closeExistingGracefully(): void {
    const current = this._modal();
    if (current && current.resolve) {
      current.resolve(false);
    }
  }

  confirm(
    message: string,
    options?: Partial<Omit<ModalConfig, 'id' | 'message' | 'type'>>
  ): Promise<boolean> {
    return new Promise(resolve => {
      this._closeExistingGracefully();
      this._modal.set({
        id: ++this.id,
        type: 'confirm',
        message,
        title: options?.title ?? 'Confirm',
        confirmText: options?.confirmText ?? 'Confirm',
        cancelText: options?.cancelText ?? 'Cancel',
        notice: options?.notice,
        resolve,
      });
    });
  }

  alert(
    message: string,
    options?: Partial<Omit<ModalConfig, 'id' | 'message' | 'type'>>
  ): void {
    this._closeExistingGracefully();
    this._modal.set({
      id: ++this.id,
      type: 'alert',
      message,
      title: options?.title ?? 'Notice',
      confirmText: options?.confirmText ?? 'OK',
    });
  }

  /** Called only by Confirm button */
  confirmResult(): void {
    const modal = this._modal();
    modal?.resolve?.(true);
    this._modal.set(null);
  }

  /** Called by Cancel, backdrop, ESC */
  cancelResult(payload: any = false): void {
    const modal = this._modal();
    modal?.resolve?.(payload);
    this._modal.set(null);
  }

  openImport(): void {
    this._closeExistingGracefully();
    this._modal.set({
      id: ++this.id,
      type: 'custom',
      title: 'Import Backup',
      view: 'import',
    });
  }

  openTaskDetail(task: Task): void {
    this._closeExistingGracefully();
    this._modal.set({
      id: ++this.id,
      type: 'custom',
      title: `Task-${task.id.substring(0, 4).toUpperCase()} Details`,
      view: 'task',
      taskData: task
    });
  }

  openCreateWorkspace(): Promise<boolean> {
    return new Promise(resolve => {
      this._closeExistingGracefully();
      this._modal.set({
        id: ++this.id,
        type: 'custom',
        title: 'Create Workspace',
        view: 'create-workspace',
        resolve
      });
    });
  }

  openEditWorkspace(workspace: Workspace): Promise<boolean> {
    return new Promise(resolve => {
      this._closeExistingGracefully();
      this._modal.set({
        id: ++this.id,
        type: 'custom',
        title: 'Edit Workspace',
        view: 'edit-workspace',
        workspaceData: workspace,
        resolve
      });
    });
  }

  openFileDetails(entry: FileExplorerEntry): void {
    this._closeExistingGracefully();
    this._modal.set({
      id: ++this.id,
      type: 'custom',
      title: 'Item Details',
      view: 'details',
      explorerEntryData: entry
    });
  }
  
  openGlobalSearch(): void {
    this._closeExistingGracefully();
    this._modal.set({
      id: ++this.id,
      type: 'custom',
      title: 'Global Search',
      view: 'global-search'
    });
  }
}
