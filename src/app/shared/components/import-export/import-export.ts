import { Component } from '@angular/core';
import { UserExportImportService } from '../../../core/storage/export-import/user-export-import';
import { ExportImportService } from '../../../core/storage/export-import/export-import';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ToastRelayService } from '../../../services/ui/common/toast/toast-relay';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ImportScope = 'workspace' | 'user';
@Component({
  selector: 'app-import-export',
  imports: [CommonModule, FormsModule ],
  templateUrl: './import-export.html',
  styleUrl: './import-export.scss',
})
export class ImportExport {

  scope: ImportScope = 'workspace';
  file: File | null = null;
  loading = false;
  scopeOpen = false;

  constructor(
    private workspaceEI: ExportImportService,
    private userEI: UserExportImportService,
    private modal: ModalService,
    private toast: ToastService,
    private toastRelay: ToastRelayService
  ) {}

  /* File handling */

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.file = input.files[0];
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.file = file;
  }

  clearFile(): void {
    this.file = null;
  }

  /* Import submit (SINGLE FLOW) */

  async submitImport(): Promise<void> {
    if (!this.file || this.loading) return;

    this.loading = true;

    try {
      const success =
        this.scope === 'workspace'
          ? await this.workspaceEI.importWorkspace(
              this.file,
              name => this.confirmReplace(name)
            )
          : await this.userEI.importUser(
              this.file,
              name => this.confirmReplace(name)
            );

      if (!success) return;

      this.toastRelay.set(
        'success',
        this.scope === 'workspace'
          ? 'Workspace imported successfully.'
          : 'User backup imported successfully.'
      );

      this.modal.cancelResult(); // close modal
      location.reload();

    } catch (err) {
      this.toast.error(
        (err as Error)?.message || 'Import failed.'
      );
      this.modal.cancelResult();
    } finally {
      this.loading = false;
      this.file = null;
    }
  }

  /*  Duplicate confirmation */

  private confirmReplace(name: string): Promise<boolean> {
    return this.modal.confirm(
      `"${name}" already exists. Do you want to replace it?`,
      {
        title: 'Replace Data',
        confirmText: 'Replace',
        cancelText: 'Cancel',
      }
    );
  }

  setScope(value: 'workspace' | 'user') {
    this.scope = value;
    this.scopeOpen = false;
  }

}
