import { Component } from '@angular/core';
import { BackupService } from '../../../core/backup/backup.service';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ExportScope = 'workspace' | 'user';

@Component({
  selector: 'app-export',
  imports: [CommonModule, FormsModule],
  templateUrl: './export.html',
  styleUrl: './export.scss',
})
export class Export {
  
  isExporting = false;

  constructor(
    private readonly backup: BackupService,
    private readonly toast: ToastService,
    private readonly modal: ModalService
  ) {}

  async exportWorkspace(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Export the entire workspace backup?'
    );
    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportWorkspace();
      this.toast.success('Workspace exported successfully');
    });
  }

  async exportCurrentUser(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Export your user backup?'
    );
    if (!confirmed) return;

    await this.run(async () => {
      await this.backup.exportCurrentUser();
      this.toast.success('User exported successfully');
    });
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
