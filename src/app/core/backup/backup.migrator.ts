import {
  QuilixBackup,
  BACKUP_VERSION,
} from './backup.types';

const LEGACY_V0 = 0;


export interface NormalizedBackup extends Omit<QuilixBackup, 'version'> {
  version: number;
}

export class BackupMigrator {

  static normalize(backup: QuilixBackup): NormalizedBackup {
    return {
      ...backup,
      version: BACKUP_VERSION,
    };
  }

  static migrate(
    backup: NormalizedBackup,
    targetVersion: number
  ): NormalizedBackup {

    let current = { ...backup };

    while (current.version < targetVersion) {
      switch (current.version) {
        case 0:
          current = this.migrateV0toV1(current);
          break;

        default:
          throw new Error(
            `No migrator available for version ${current.version}`
          );
      }
    }

    return current;
  }

  private static migrateV0toV1(
    backup: NormalizedBackup
  ): NormalizedBackup {
    
    return {
      ...backup,
      version: BACKUP_VERSION,
      data: {
        ...backup.data,
        meta: {
          ...backup.data?.meta,
          migratedFromVersion: LEGACY_V0,
          migratedAt: Date.now(),
        },
      },
    };
  }
  
}
