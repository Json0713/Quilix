import { Injectable } from '@angular/core';

export type BackupFileFormat = 'json' | 'backup';

@Injectable({
  providedIn: 'root',
})
export class BackupShareService {

  async shareOrDownload(
    payload: unknown,
    filename: string,
    format: BackupFileFormat
  ): Promise<void> {

    const file = this.createFile(payload, filename, format);

    if (this.canNativeShare(file)) {
      try {
        await navigator.share({
          title: 'Quilix Backup',
          files: [file],
        });
        return;
      } catch {
        // intentional fallback
      }
    }

    this.forceDownload(file);
  }

  /* ───────────────────────── INTERNAL ───────────────────────── */
  private createFile(
    payload: unknown,
    filename: string,
    format: BackupFileFormat
  ): File {

    const content = this.safeStringify(payload);
    const safeName = this.sanitizeFilename(filename);

    if (format === 'json') {
      return new File(
        [content],
        this.ensureExtension(safeName, '.json'),
        { type: 'application/json;charset=utf-8' }
      );
    }

    return new File(
      [content],
      this.ensureExtension(safeName, '.quilix-backup'),
      { type: 'application/vnd.quilix.backup+json' }
    );
  }

  private safeStringify(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      throw new Error('Backup data is not serializable.');
    }
  }

  private sanitizeFilename(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private ensureExtension(name: string, ext: string): string {
    return name.endsWith(ext)
      ? name
      : name.replace(/\.[^/.]+$/, '') + ext;
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
