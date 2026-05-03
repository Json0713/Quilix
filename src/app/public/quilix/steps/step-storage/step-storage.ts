import { Component, inject, output, signal, OnInit } from '@angular/core';
import { FileSystemService } from '../../../../core/services/data/file-system.service';

@Component({
  selector: 'app-step-storage',
  standalone: true,
  templateUrl: './step-storage.html',
  styleUrl: './step-storage.scss',
})
export class StepStorage implements OnInit {

  private readonly fs = inject(FileSystemService);
  readonly continue = output<void>();

  readonly isFileSystemSupported = this.fs.isSupported();
  readonly storageMode = signal<'indexeddb' | 'filesystem'>('indexeddb');
  readonly fsConnected = this.fs.hasPermission;

  async ngOnInit(): Promise<void> {
    const mode = await this.fs.getStorageMode();
    this.storageMode.set(mode);
  }

  selectIndexedDB(): void {
    this.storageMode.set('indexeddb');
  }

  selectFileSystem(): void {
    if (this.isFileSystemSupported) {
      this.storageMode.set('filesystem');
    }
  }

  async connectFolder(): Promise<void> {
    await this.fs.requestDirectoryAccess();
  }

}
