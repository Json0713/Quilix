export type ModalNoticeType = 'info' | 'success' | 'warning' | 'error';
export type ModalType = 'confirm' | 'alert' | 'custom';
export type ModalNoticeScope = 'once' | 'always';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
import { Task } from '../../../../core/interfaces/task';
import { Workspace } from '../../../../core/interfaces/workspace';

export interface ModalNotice {
  type: ModalNoticeType;
  message: string;

  scope?: ModalNoticeScope;
}

export interface ModalConfig {
  id: number;
  type: ModalType;

  title?: string;
  message?: string;

  notice?: ModalNotice;

  confirmText?: string;
  cancelText?: string;

  resolve?: (result: boolean | any) => void;

  view?: 'import' | 'task' | 'create-workspace' | 'edit-workspace';
  taskData?: Task;
  workspaceData?: Workspace;
}
