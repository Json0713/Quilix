import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemService } from '../../../../core/services/file-system.service';

@Component({
    selector: 'app-storage-toggle',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './storage-toggle.html',
    styleUrl: './storage-toggle.scss',
})
export class StorageToggleComponent implements OnInit {
    private fileSystem = inject(FileSystemService);

    isSupported = signal<boolean>(false);
    storageMode = signal<'indexeddb' | 'filesystem'>('indexeddb');
    isProcessing = signal<boolean>(false);

    async ngOnInit() {
        this.isSupported.set(this.fileSystem.isSupported());
        if (this.isSupported()) {
            const mode = await this.fileSystem.getStorageMode();
            this.storageMode.set(mode);
        }
    }

    async toggleStorage() {
        if (this.isProcessing()) return;
        this.isProcessing.set(true);

        try {
            if (this.storageMode() === 'indexeddb') {
                const success = await this.fileSystem.requestDirectoryAccess();
                if (success) {
                    this.storageMode.set('filesystem');
                }
            } else {
                await this.fileSystem.disableFileSystem();
                this.storageMode.set('indexeddb');
            }
        } finally {
            this.isProcessing.set(false);
        }
    }
}
