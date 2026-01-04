export type ModalType = 'confirm' | 'alert' | 'custom';
export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalConfig {
  id: number;
  type: ModalType;

  title?: string;
  message?: string;

  confirmText?: string;
  cancelText?: string;

  resolve?: (result: boolean) => void;
  
  view?: 'import-export';
}
