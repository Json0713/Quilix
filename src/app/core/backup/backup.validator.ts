import {
  QuilixBackup,
  BackupScope,
  AnyBackupVersion,
  BACKUP_VERSION,
} from './backup.types';


export class BackupValidator {

  static validate(payload: unknown): asserts payload is QuilixBackup {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Backup payload is not an object.');
    }

    const backup = payload as Partial<QuilixBackup>;

    this.validateRoot(backup);
    this.validateScope(backup.scope);
    this.validateData(backup);
  }

  /* ───────────────────────── ROOT ───────────────────────── */
  private static validateRoot(
    backup: Partial<QuilixBackup>
  ): void {
    if (backup.app !== 'Quilix') {
      throw new Error('Invalid Quilix backup.');
    }

    if (!this.isSupportedVersion(backup.version)) {
      throw new Error('Unsupported backup version.');
    }

    if (
      typeof backup.exportedAt !== 'number' ||
      Number.isNaN(backup.exportedAt)
    ) {
      throw new Error('Invalid export timestamp.');
    }

    if (!backup.meta || typeof backup.meta !== 'object') {
      throw new Error('Backup metadata is missing or invalid.');
    }

    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('Backup data is missing or invalid.');
    }
  }

  /* ───────────────────────── SCOPE ───────────────────────── */
  private static validateScope(
    scope?: BackupScope
  ): void {
    if (scope !== 'appspace' && scope !== 'workspace') {
      throw new Error('Invalid backup scope.');
    }
  }

  /* ───────────────────────── DATA ───────────────────────── */
  private static validateData(
    backup: Partial<QuilixBackup>
  ): void {
    const data = backup.data;

    if (!data || typeof data !== 'object') {
      throw new Error('Backup data is invalid.');
    }

    if (backup.scope === 'workspace') {
      if (!Array.isArray(data.workspaces) || data.workspaces.length !== 1) {
        throw new Error(
          'Workspace backup must contain exactly one workspace.'
        );
      }
    }
  }

  /* ───────────────────────── VERSION ───────────────────────── */
  private static isSupportedVersion(
    version?: AnyBackupVersion
  ): boolean {
    return (
      version === BACKUP_VERSION ||
      version === '0.1.0'
    );
  }

}
