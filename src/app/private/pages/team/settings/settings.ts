import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppThemeService } from '../../../../core/services/ui/app-theme.service';
import { OsNotificationService } from '../../../../core/services/ui/os-notification.service';
import { TabService } from '../../../../core/services/ui/tab.service';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { StorageToggleComponent } from '../../../../shared/ui/system/storage-toggle/storage-toggle';
import { FileSystemService } from '../../../../core/services/data/file-system.service';

@Component({
    selector: 'app-team-settings',
    standalone: true,
    imports: [RouterModule, StorageToggleComponent],
    templateUrl: './settings.html',
    styleUrl: './settings.scss',
})
export class TeamSettings {
    private themeService = inject(AppThemeService);
    protected osNotify = inject(OsNotificationService);
    private fileSystem = inject(FileSystemService);
    private tabService = inject(TabService);
    private breadcrumbService = inject(BreadcrumbService);

    currentTheme = this.themeService.theme;

    isFileSystemMode = signal(false);

    constructor() {
        this.checkStorageMode();
        this.breadcrumbService.setTitle('Team Settings');
        this.tabService.updateActiveTabRoute('./settings', 'Settings', 'bi bi-gear');
    }

    private async checkStorageMode() {
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');
    }

    setTheme(mode: 'light' | 'dark' | 'system') {
        this.themeService.apply(mode);
    }
}
