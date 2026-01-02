import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BackupShareService {

  async shareOrDownload(
    payload: unknown,
    filename: string
  ): Promise<void> {
    const json = JSON.stringify(payload, null, 2);
    const file = new File([json], filename, {
      type: 'application/json',
    });

    // Try share ONLY if clearly supported
    if (this.canShareFile(file)) {
      try {
        await navigator.share({
          title: 'Quilix Backup',
          files: [file],
        });
        return;
      } catch {
        // Fallback to download
      }
    }

    this.download(file);
  }

  private canShareFile(file: File): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof (navigator as any).canShare === 'function' &&
      (navigator as any).canShare({ files: [file] })
    );
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');

    a.href = url;
    a.download = file.name;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
  
}
