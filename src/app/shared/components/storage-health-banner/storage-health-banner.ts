import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-storage-health-banner',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './storage-health-banner.html',
    styleUrls: ['./storage-health-banner.scss']
})
export class StorageHealthBannerComponent {
    @Input() isFileSystemMode = false;
    @Input() needsReauth = false;
    @Input() isReauthing = false;
    @Input() missingCount = 0;

    @Output() reconnectStorage = new EventEmitter<void>();

    get bannerState(): 'synced' | 'indexeddb' | 'missing' | 'reauth' {
        if (!this.isFileSystemMode) {
            return 'indexeddb';
        }
        if (this.needsReauth) {
            return 'reauth';
        }
        if (this.missingCount > 0) {
            return 'missing';
        }
        return 'synced';
    }
}
