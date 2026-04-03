import { Component, inject, signal, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemSyncService } from '../../../core/services/sync/system-sync.service';
import { ToastService } from '../../../services/ui/common/toast/toast';
import { FileSystemService } from '../../../core/services/data/file-system.service';

@Component({
    selector: 'app-storage-backup',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './storage-backup.html',
    styleUrls: ['./storage-backup.scss']
})
export class StorageBackupComponent implements OnInit {
    private systemSync = inject(SystemSyncService);
    private toastService = inject(ToastService);
    private fileSystem = inject(FileSystemService);

    @Input() isFileSystemMode = false;

    isBackingUp = signal(false);
    isRestoring = signal(false);
    lastBackupTime = signal<number | null>(null);

    async ngOnInit() {
        if (this.isFileSystemMode) {
            this.lastBackupTime.set(await this.systemSync.getLastExportTime());
        }
    }

    async performBackup() {
        if (this.isBackingUp() || !this.isFileSystemMode) return;
        this.isBackingUp.set(true);
        try {
            const success = await this.systemSync.exportStateToDisk();
            if (success) {
                this.lastBackupTime.set(Date.now());
                this.toastService.success('System state successfully backed up to disk.');
            } else {
                this.toastService.error('Backup failed. Check storage permissions.');
            }
        } catch (error) {
            console.error('Backup error:', error);
            this.toastService.error('An unexpected error occurred during backup.');
        } finally {
            this.isBackingUp.set(false);
        }
    }

    async performRestore() {
        if (this.isRestoring() || !this.isFileSystemMode) return;

        // Confirm first? This will merge data.
        const confirmed = confirm('This will merge any data found from your physical Quilix folder into your app. This action cannot be reversed. Continue?');
        if (!confirmed) return;

        this.isRestoring.set(true);
        try {
            const success = await this.systemSync.importStateFromDisk();
            if (success) {
                this.toastService.success('System state restored and merged successfully.');
                // Need to reload window to refresh state properly from indexedDB
                setTimeout(() => window.location.reload(), 1500);
            } else {
                this.toastService.error('Restore failed. No sync file found or access denied.');
            }
        } catch (error) {
            console.error('Restore error:', error);
            this.toastService.error('An unexpected error occurred during restore.');
        } finally {
            this.isRestoring.set(false);
        }
    }
}
