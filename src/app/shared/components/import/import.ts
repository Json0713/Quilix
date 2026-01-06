import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../../../core/backup/backup.service';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ToastRelayService } from '../../../services/ui/common/toast/toast-relay';

type ImportScope = 'workspace' | 'user';

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule],
  templateUrl: './import.html',
  styleUrl: './import.scss',
})
export class Import {

  scope: ImportScope = 'workspace';
  file: File | null = null;
  loading = false;
  scopeOpen = false;

  constructor(
    private backup: BackupService,
    private modal: ModalService,
    private toast: ToastService,
    private toastRelay: ToastRelayService
  ) {}

  /* ───────────── FILE HANDLING ───────────── */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.file = input.files[0];
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.file = event.dataTransfer?.files?.[0] ?? null;
  }

  clearFile(): void {
    this.file = null;
  }

  /* ───────────── IMPORT ───────────── */
  async submitImport(): Promise<void> {
    if (!this.file || this.loading) return;

    this.loading = true;

    try {
      const result = await this.backup.importBackup(
        this.file,
        this.scope,
        name => this.confirmReplace(name)
      );

      if (this.scope === 'workspace') {
        this.toastRelay.set(
          'success',
          'Workspace imported successfully.'
        );

        this.modal.cancelResult();
        location.reload();
        return;
      }

      // USER IMPORT
      if (!result.importedUsers.length) {
        throw new Error('No users were imported.');
      }

      this.toastRelay.set(
        'success',
        `User "${result.importedUsers[0].name}" imported successfully.`
      );

      this.modal.cancelResult();

      // IMPORTANT:
      // If you don't have a UserStore yet, reload once
      setTimeout(() => location.reload(), 100);

    } catch (err) {
      if ((err as Error)?.message !== 'IMPORT_CANCELLED') {
        this.toast.error(
          (err as Error)?.message || 'Import failed.'
        );
      }
      this.modal.cancelResult();
    } finally {
      this.loading = false;
      this.file = null;
    }
  }

  /* ───────────── HELPERS ───────────── */
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

  setScope(value: ImportScope): void {
    this.scope = value;
    this.scopeOpen = false;
  }

}
