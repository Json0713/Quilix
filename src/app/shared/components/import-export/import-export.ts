import { Component } from '@angular/core';
import { UserExportImportService } from '../../../core/storage/export-import/user-export-import';
import { ExportImportService } from '../../../core/storage/export-import/export-import';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ToastRelayService } from '../../../services/ui/common/toast/toast-relay';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-import-export',
  imports: [CommonModule ],
  templateUrl: './import-export.html',
  styleUrl: './import-export.scss',
})
export class ImportExport {

    constructor(
    private modal: ModalService,
    private toast: ToastService,
    private toastRelay: ToastRelayService,
    private ei: ExportImportService,
    private userEI: UserExportImportService,
  ) {}

  // Import/Export Helprer
  private async confirmReplace(name: string): Promise<boolean> {
    return this.modal.confirm(
      `A workspace named "${name}" already exists. Do you want to replace it?`,
      {
        title: 'Replace Workspace',
        confirmText: 'Replace',
        cancelText: 'Cancel',
      }
    );
  }

  async importWorkspace(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    try {
      const success = await this.ei.importWorkspace(
        input.files[0],
        name => this.confirmReplace(name)
      );

      if (!success) return;

      // SUCCESS → persist across reload
      this.toastRelay.set(
        'success',
        'Workspace imported successfully.'
      );

      this.modal.cancelResult();
      location.reload();

    } catch (err) {
      // ERROR → immediate UI feedback
      this.modal.cancelResult();
      this.toast.error((err as Error).message);
    } finally {
      input.value = '';
    }
  }

  async importUser(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    try {
      const success = await this.userEI.importUser(
        input.files[0],
        name => this.confirmReplace(name)
      );

      if (!success) return;

      this.toastRelay.set(
        'success',
        'User backup imported successfully.'
      );

      this.modal.cancelResult();
      location.reload();

    } catch (err) {
      this.modal.cancelResult();
      this.toast.error((err as Error).message);
    } finally {
      input.value = '';
    }
  }

}
