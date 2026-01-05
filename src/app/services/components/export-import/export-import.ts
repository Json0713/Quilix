import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../../../core/storage/storage.key';
import { User } from '../../../core/interfaces/user';
import { BackupShareService } from '../share/backup-share';

export interface WorkspaceExport {
  app: 'Quilix';
  version: string;
  scope: 'workspace';
  exportedAt: number;
  data: {
    users?: User[];
    session?: unknown;
    meta?: unknown;
    [key: string]: unknown;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ExportImportService {

  private readonly VERSION = '0.1.0';

  constructor(private share: BackupShareService) {}

  /** EXPORT WORKSPACE */
  async exportWorkspace(): Promise<void> {
    const data: WorkspaceExport['data'] = {};

    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw) {
        data[key.replace('quilix_', '')] = JSON.parse(raw);
      }
    }

    const payload: WorkspaceExport = {
      app: 'Quilix',
      version: this.VERSION,
      scope: 'workspace',
      exportedAt: Date.now(),
      data,
    };

    await this.share.shareOrDownload(
      payload,
      `quilix-workspace-${Date.now()}.json`
    );
  }

  /** IMPORT WORKSPACE */
  async importWorkspace(
    file: File,
    confirmReplace: (name: string) => Promise<boolean>
  ): Promise<boolean> {
    const parsed = await this.read(file);
    this.validate(parsed, 'workspace');

    if (parsed.data.users) {
      const existingUsers = this.getUsers();
      const importedUsers = parsed.data.users as User[];

      for (const imported of importedUsers) {
        const index = existingUsers.findIndex(
          u => u.name.toLowerCase() === imported.name.toLowerCase()
        );

        if (index === -1) {
          existingUsers.push(imported);
        } else {
          const shouldReplace = await confirmReplace(imported.name);

          if (!shouldReplace) {
            return false;
          }

          existingUsers[index] = imported;
        }
      }

      localStorage.setItem(
        STORAGE_KEYS.USERS,
        JSON.stringify(existingUsers)
      );
    }

    for (const [key, value] of Object.entries(parsed.data)) {
      if (key === 'users') continue;
      localStorage.setItem(`quilix_${key}`, JSON.stringify(value));
    }

    return true;
  }

  private getUsers(): User[] {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEYS.USERS) ?? '[]'
    );
  }

  private async read(file: File): Promise<WorkspaceExport> {
    return JSON.parse(await file.text());
  }

  private validate(payload: WorkspaceExport, scope: 'workspace'): void {
    if (payload.app !== 'Quilix') throw new Error('Invalid Quilix backup.');
    if (payload.scope !== scope) throw new Error('Invalid backup scope.');
  }

}
