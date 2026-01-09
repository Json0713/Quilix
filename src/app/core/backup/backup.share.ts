import { Injectable } from '@angular/core';

const BACKUP_EXTENSION = '.quilix-backup';
const BACKUP_MIME = 'application/octet-stream';

@Injectable({
  providedIn: 'root',
})
export class BackupShareService {

  async shareOrDownload(
    payload: unknown,
    filename: string
  ): Promise<void> {

    const normalizedFilename = this.normalizeFilename(filename);
    const file = this.createBackupFile(payload, normalizedFilename);

    if (this.canNativeShare(file)) {
      try {
        await navigator.share({
          title: 'Quilix Backup',
          files: [file],
        });
        return;
      } catch {
        // Fallback
      }
    }

    this.forceDownload(file);
  }

  /* ───────────────────────── INTERNAL ───────────────────────── */
  private createBackupFile(
    payload: unknown,
    filename: string
  ): File {
    const content = JSON.stringify(payload, null, 2);

    return new File([content], filename, {
      type: BACKUP_MIME,
    });
  }

  private normalizeFilename(filename: string): string {
    return filename.endsWith(BACKUP_EXTENSION)
      ? filename
      : filename.replace(/\.json$/i, '') + BACKUP_EXTENSION;
  }

  private canNativeShare(file: File): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof (navigator as any).canShare === 'function' &&
      (navigator as any).canShare({ files: [file] })
    );
  }

  private forceDownload(file: File): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = file.name;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }

}
