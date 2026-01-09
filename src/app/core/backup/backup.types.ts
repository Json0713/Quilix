import { User } from '../interfaces/user';
import { Session } from '../interfaces/session';

/**
 * Increment ONLY when a breaking change happens.
 * Never reuse version numbers.
 */
export const BACKUP_VERSION = 1 as const;

export type BackupVersion = typeof BACKUP_VERSION;

/** Legacy versions supported for migration */
export type LegacyBackupVersion = '0.1.0';

export type AnyBackupVersion = BackupVersion | LegacyBackupVersion;

/**
 * Defines what kind of backup this is.
 * - workspace: full app data
 * - user: single user snapshot
 */
export type BackupScope = 'workspace' | 'user';

/**
 * Root backup structure.
 * This is the ONLY valid Quilix backup format.
 */
export interface QuilixBackup {
  app: 'Quilix';
  version: AnyBackupVersion;
  scope: BackupScope;
  exportedAt: number;
  data: BackupData;
}

/**
 * Container for all persisted entities.
 * Optional fields allow partial backups and future expansion.
 */
export interface BackupData {
  users?: User[];
  session?: Session | null;

  // Future entities
  tasks?: unknown[];
  notes?: unknown[];
  boards?: unknown[];
  progress?: unknown[];

  meta?: BackupMeta;
}

/**
 * App-level metadata (non-user content).
 */
export interface BackupMeta {
  appVersion?: string;
  createdAt?: number;

  // numeric, not string
  migratedFromVersion?: number;
  migratedAt?: number;
  
}


