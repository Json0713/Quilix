export type ModalType = 'confirm' | 'alert';

export interface ModalConfig {
  id: number;
  type: ModalType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (result: boolean) => void;
}
