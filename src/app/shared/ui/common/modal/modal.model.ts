export type ModalNoticeType = 'info' | 'success' | 'warning' | 'error';
export type ModalType = 'confirm' | 'alert' | 'custom';
export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalNotice {
  type: ModalNoticeType;
  message: string;
}

export interface ModalConfig {
  id: number;
  type: ModalType;

  title?: string;
  message?: string;

  notice?: ModalNotice;

  confirmText?: string;
  cancelText?: string;

  resolve?: (result: boolean) => void;
  
  view?: 'import';
}
