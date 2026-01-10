import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BackupService } from '../../../core/backup/backup.service';
import { BackupFileFormat } from '../../../core/backup/backup.share';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ModalService } from '../../../services/ui/common/modal/modal';

type ExportScope = 'workspace' | 'user';


@Component({
  selector: 'app-export',
  imports: [CommonModule, FormsModule],
  templateUrl: './export.html',
  styleUrl: './export.scss',
})
export class Export {

  isExporting = false;
  format: BackupFileFormat = 'backup';

  constructor(
    private readonly backup: BackupService,
    private readonly toast: ToastService,
    private readonly modal: ModalService
  ) {}

  /* ───────────────────────── EXPORT ACTIONS ───────────────────────── */
  async exportCurrentUser(): Promise<void> {
    if (this.isExporting) return;

    const confirmed = await this.modal.confirm(
      this.buildUserExportMessage(),
      {
        title: 'Export Your Data',
        confirmText: 'Export',
        cancelText: 'Cancel',
        notice: {
          type: 'info',
          message:
            'User export includes only your account and session data. ' +
            'It does not affect other users.',
        },
      }
    );

    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportCurrentUser(
        this.format,
        this.buildFilename('user')
      );

      this.toast.success(
        'Your backup file has been saved on your device.'
      );
    });
  }

  async exportWorkspace(): Promise<void> {
    if (this.isExporting) return;

    const confirmed = await this.modal.confirm(
      this.buildWorkspaceExportMessage(),
      {
        title: 'Export Workspace',
        confirmText: 'Export Workspace',
        cancelText: 'Cancel',
        notice: {
          type: 'info',
          message:
            'Export Workspace includes only your account and session data. ' +
            '',
        },
      }
    );

    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportWorkspace(
        this.format,
        this.buildFilename('workspace')
      );

      this.toast.success(
        'The workspace backup has been saved on your device.'
      );
    });
  }

  /* ───────────────────────── MESSAGE BUILDERS ───────────────────────── */
  private buildUserExportMessage(): string {
    return [
      'You are about to export your user backup.',
      '',
      'This includes:',
      '• Your profile',
      '• Your session data',
      '',
      'The file will be saved locally on your device.',
      'You can keep it as a backup or restore it later if needed.',
    ].join('\n');
  }

  private buildWorkspaceExportMessage(): string {
    return [
      'You are about to export the entire workspace.',
      '',
      'This includes:',
      '• All users',
      '• Sessions',
      '• App data and settings',
      '',
      'The file will be saved locally on your device.',
      'Nothing is uploaded or shared automatically.',
    ].join('\n');
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
  private buildFilename(scope: ExportScope): string {
    return `quilix-${scope}-${Date.now()}`;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.isExporting = true;

    try {
      await action();
    } catch (err) {
      this.toast.error(this.resolveError(err));
    } finally {
      this.isExporting = false;
    }
  }

  private resolveError(err: unknown): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }

    return 'Something went wrong while creating the backup. Please try again.';
  }

}
