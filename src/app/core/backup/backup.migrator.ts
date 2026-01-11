import {
  QuilixBackup,
  BACKUP_VERSION,
  AnyBackupVersion,
} from './backup.types';

/* numeric internal versions */
const LEGACY_V0 = 0;

export interface NormalizedBackup
  extends Omit<QuilixBackup, 'version'> {
  version: number;
}

export class BackupMigrator {

  /* ───────────────────────── NORMALIZE ───────────────────────── */
  static normalize(
    backup: QuilixBackup
  ): NormalizedBackup {

    return {
      ...backup,
      version: this.normalizeVersion(backup.version),
    };
  }

  private static normalizeVersion(
    version: AnyBackupVersion
  ): number {
    if (version === BACKUP_VERSION) {
      return BACKUP_VERSION;
    }

    if (version === '0.1.0') {
      return LEGACY_V0;
    }

    throw new Error(`Unknown backup version: ${version}`);
  }

  /* ───────────────────────── MIGRATE ───────────────────────── */
  static migrate(
    backup: NormalizedBackup,
    targetVersion: number
  ): NormalizedBackup {

    let current = { ...backup };

    while (current.version < targetVersion) {
      switch (current.version) {

        case LEGACY_V0:
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

  /* ───────────────────────── V0 → V1 ───────────────────────── */
  private static migrateV0toV1(
    backup: NormalizedBackup
  ): NormalizedBackup {

    return {
      ...backup,
      version: 1,
      meta: {
        ...backup.meta,
        migratedFromVersion: LEGACY_V0,
        migratedAt: Date.now(),
      },
    };
  }

}
