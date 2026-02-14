import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BackupService } from '../../../core/backup/backup.service';
import { BackupFileFormat } from '../../../core/backup/backup.share';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ModalService } from '../../../services/ui/common/modal/modal';

type ExportScope = 'workspace' | 'appspace';


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
  ) { }

  /* ───────────────────────── EXPORT ACTIONS ───────────────────────── */
  async exportWorkspace(): Promise<void> {
    if (this.isExporting) return;

    const { label, extension } = this.getFormatInfo();

    const confirmed = await this.modal.confirm(
      this.buildWorkspaceMessage(),
      {
        title: 'Export Workspace',
        confirmText: 'Export',
        cancelText: 'Cancel',
        notice: {
          type: 'info',
          scope: 'once',
          message:
            `Your active workspace will be saved as a ${label} file.`,
        },
      }
    );

    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportCurrentWorkspace(
        this.format,
        this.buildFilename('workspace')
      );

      this.toast.success(
        'Workspace backup saved.'
      );
    });
  }

  async exportAppspace(): Promise<void> {
    if (this.isExporting) return;

    const { label, extension } = this.getFormatInfo();

    const confirmed = await this.modal.confirm(
      this.buildAppspaceMessage(),
      {
        title: 'Export Appspace',
        confirmText: 'Export Everything',
        cancelText: 'Cancel',
        notice: {
          type: 'warning',
          message:
            `All workspaces and app settings will be exported as a ${label} file.`,
        },
      }
    );

    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportAppspace(
        this.format,
        this.buildFilename('appspace')
      );

      this.toast.success(
        'Appspace backup saved.'
      );
    });
  }

  /* ───────────────────────── MESSAGE BUILDERS ───────────────────────── */
  private buildWorkspaceMessage(): string {
    return [
      'You are about to export an individual workspace backup.',
      '',
      'This includes:',
      '• Workspace Profile',
      '• All accounts within this workspace',
      '',
      'The file can be restored later using the Import feature.',
    ].join('\n');
  }

  private buildAppspaceMessage(): string {
    return [
      'You are about to export your entire "Appspace".',
      '',
      'This includes:',
      '• EVERY Workspace in this application',
      '• Global app settings and configurations',
      '• All locally stored metadata',
      '',
      'Use this for full application migrations or safety backups.',
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

  private getFormatInfo(): { label: string; extension: string } {
    switch (this.format) {
      case 'json':
        return { label: 'JSON', extension: '.json' };
      case 'backup':
      default:
        return { label: 'Quilix Backup', extension: '.backup' };
    }
  }

}
