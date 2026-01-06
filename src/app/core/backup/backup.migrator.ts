import { QuilixBackup } from './backup.types';

interface InternalBackup {
  app: 'Quilix';
  version: number; // migration-only numeric version
  scope: string;
  exportedAt: number;
  data: any;
}

export class BackupMigrator {

  static migrate(
    backup: InternalBackup,
    targetVersion: number
  ): InternalBackup {

    let migrated = { ...backup };

    while (migrated.version < targetVersion) {
      switch (migrated.version) {
        case 0:
          migrated = this.migrateV0toV1(migrated);
          break;

        default:
          throw new Error(
            `No migrator for version ${migrated.version}`
          );
      }
    }

    return migrated;
  }

  private static migrateV0toV1(
    backup: InternalBackup
  ): InternalBackup {

    return {
      ...backup,
      version: 1,
      data: {
        ...backup.data,
        meta: {
          ...backup.data.meta,
          migratedFromVersion: 0,
          migratedAt: Date.now(),
        },
      },
    };
  }
  
}
