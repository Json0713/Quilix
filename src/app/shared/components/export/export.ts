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
  format: BackupFileFormat = 'backup'; // default = mobile-safe

  constructor(
    private readonly backup: BackupService,
    private readonly toast: ToastService,
    private readonly modal: ModalService
  ) {}

  /* ───────────────────────── EXPORT ACTIONS ───────────────────────── */
  async exportWorkspace(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Export the entire workspace backup?'
    );
    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportWorkspace(
        this.format,
        this.buildFilename('workspace')
      );
      this.toast.success('Workspace exported successfully.');
    });
  }

  async exportCurrentUser(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Export your user backup?'
    );
    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportCurrentUser(
        this.format,
        this.buildFilename('user')
      );
      this.toast.success('User exported successfully.');
    });
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
    if (err instanceof Error) {
      return err.message;
    }
    return 'Export failed. Please try again.';
  }

}
