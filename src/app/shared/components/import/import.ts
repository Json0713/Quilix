import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BackupService } from '../../../core/backup/backup.service';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ToastRelayService } from '../../../services/ui/common/toast/toast-relay';

type ImportScope = 'workspace' | 'user';

const ALLOWED_EXTENSIONS = [
  '.json',
  '.quilix-backup',
];


@Component({
  selector: 'app-import',
  standalone: true,
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
    private readonly backup: BackupService,
    private readonly modal: ModalService,
    private readonly toast: ToastService,
    private readonly toastRelay: ToastRelayService
  ) {}

  /* ───────────── FILE HANDLING ───────────── */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0] ?? null;

    this.setFile(selected);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const dropped = event.dataTransfer?.files?.[0] ?? null;

    this.setFile(dropped);
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

      if (!result.importedUsers.length) {
        throw new Error('No users were imported.');
      }

      this.toastRelay.set(
        'success',
        `User "${result.importedUsers[0].name}" imported successfully.`
      );

      this.modal.cancelResult();
      setTimeout(() => location.reload(), 100);

    } catch (err) {
      if ((err as Error)?.message !== 'IMPORT_CANCELLED') {
        this.toast.error(
          this.resolveError(err)
        );
      }
      this.modal.cancelResult();
    } finally {
      this.loading = false;
      this.file = null;
    }
  }

  /* ───────────── VALIDATION ───────────── */
  private setFile(file: File | null): void {
    if (!file) {
      this.file = null;
      return;
    }

    if (!this.isAllowedFile(file)) {
      this.toast.error(
        'Unsupported file type. Please select a valid backup file.'
      );
      this.file = null;
      return;
    }

    this.file = file;
  }

  private isAllowedFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
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

  private resolveError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Import failed. Please try again.';
  }

  setScope(value: ImportScope): void {
    this.scope = value;
    this.scopeOpen = false;
  }

}
