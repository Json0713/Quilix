import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Export } from '../../../../../shared/components/export/export';
import { StorageBackupComponent } from '../../../../../shared/components/storage-backup/storage-backup';
import { StorageHealthComponent } from '../../../../../shared/components/storage-health/storage-health';
import { Breadcrumb } from '../../../../../shared/ui/common/breadcrumb/breadcrumb';
import { BreadcrumbService } from '../../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TabService } from '../../../../../core/services/tab.service';
import { FileSystemService } from '../../../../../core/services/file-system.service';

@Component({
    selector: 'app-team-data-management',
    standalone: true,
    imports: [CommonModule, RouterModule, Export, StorageBackupComponent, StorageHealthComponent, Breadcrumb],
    templateUrl: './data-management.html',
    styleUrl: './data-management.scss',
})
export class TeamDataManagement {
    private fileSystem = inject(FileSystemService);
    private breadcrumbService = inject(BreadcrumbService);
    private tabService = inject(TabService);

    isFileSystemMode = signal(false);

    constructor() {
        this.checkStorageMode();
        this.breadcrumbService.setTitle('Team Data Management');
        this.tabService.updateActiveTabRoute('./settings/data-management', 'Team Data Management', 'bi bi-gear');
    }

    private async checkStorageMode() {
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');
    }
}
