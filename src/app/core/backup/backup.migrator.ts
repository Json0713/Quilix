import { QuilixBackup } from './backup.types';

export interface NormalizedBackup extends Omit<QuilixBackup, 'version'> {
  version: number;
}

export class BackupMigrator {

  static normalize(backup: QuilixBackup): NormalizedBackup {
    return {
      ...backup,
      version: backup.version === '0.1.0' ? 0 : backup.version,
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
      version: 1,
      data: {
        ...backup.data,
        meta: {
          ...backup.data?.meta,
          migratedFromVersion: 0,
          migratedAt: Date.now(),
        },
      },
    };
  }
  
}
