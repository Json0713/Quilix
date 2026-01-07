import { Component } from '@angular/core';
import { BackupService } from '../../../core/backup/backup.service';
import { ToastService } from '../../../services/ui/common/toast/toast';
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
  selectedScope: ExportScope | null = null;
  isExporting = false;

  constructor(
    private backup: BackupService,
    private toast: ToastService
  ) {}

  async export(): Promise<void> {
    if (!this.selectedScope || this.isExporting) {
      return;
    }

    this.isExporting = true;

    try {
      if (this.selectedScope === 'workspace') {
        await this.backup.exportWorkspace();
      } else {
        await this.backup.exportCurrentUser();
      }

      this.toast.success(
        `${this.capitalize(this.selectedScope)} backup exported successfully`
      );
    } catch (error: any) {
      this.handleError(error);
    } finally {
      this.isExporting = false;
    }
  }

  private handleError(error: any): void {
    if (error?.message === 'No active user.') {
      this.toast.error('You must be logged in to export your user backup.');
      return;
    }

    this.toast.error('Export failed. Please try again.');
    console.error('[Export]', error);
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
