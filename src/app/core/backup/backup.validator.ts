import {
  QuilixBackup,
  BackupScope,
  AnyBackupVersion,
  BACKUP_VERSION,
  LegacyBackupVersion,
} from './backup.types';


export class BackupValidator {

  static validate(payload: QuilixBackup): void {
    this.validateRoot(payload);
    this.validateScope(payload);
    this.validateData(payload);
  }

  private static validateRoot(payload: QuilixBackup): void {
    if (payload.app !== 'Quilix') {
      throw new Error('Invalid Quilix backup.');
    }

    if (!this.isSupportedVersion(payload.version)) {
      throw new Error('Unsupported backup version.');
    }

    if (!payload.exportedAt || typeof payload.exportedAt !== 'number') {
      throw new Error('Invalid export timestamp.');
    }
  }

  private static validateScope(payload: QuilixBackup): void {
    if (payload.scope !== 'workspace' && payload.scope !== 'user') {
      throw new Error('Invalid backup scope.');
    }
  }

  private static validateData(payload: QuilixBackup): void {
    const data = payload.data;

    if (!data || typeof data !== 'object') {
      throw new Error('Backup data is missing or invalid.');
    }

    if (payload.scope === 'user') {
      if (!Array.isArray(data.users) || data.users.length !== 1) {
        throw new Error(
          'User backup must contain exactly one user.'
        );
      }
    }
  }

  private static isSupportedVersion(
    version: AnyBackupVersion
  ): boolean {
    return (
      version === BACKUP_VERSION ||
      version === '0.1.0'
    );
  }

}
