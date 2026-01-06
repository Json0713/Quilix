import { QuilixBackup, BackupScope } from '../backup/backup.types';

export class BackupValidator {

  private validate(payload: QuilixBackup): void {
    if (payload.app !== 'Quilix') {
      throw new Error('Invalid Quilix backup.');
    }

    if (payload.version !== 1 && payload.version !== '0.1.0') {
      throw new Error('Unsupported backup version.');
    }

    if (!payload.scope) {
      throw new Error('Invalid backup scope.');
    }
  }


}
