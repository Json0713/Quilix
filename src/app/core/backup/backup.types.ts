import { User } from '../interfaces/user';
import { Session } from '../interfaces/session';

/* ───────────────────────── VERSIONING ───────────────────────── */
/** Current supported backup version */
/* SINGLE SOURCE OF TRUTH */
export const BACKUP_VERSION = 1 as const;
export type BackupVersion = typeof BACKUP_VERSION;

/** Legacy versions supported for migration */
export type LegacyBackupVersion = '0.1.0';
export type AnyBackupVersion = BackupVersion | LegacyBackupVersion;

/* ───────────────────────── SCOPE ───────────────────────── */
/**
 * Defines what kind of backup this is.
 * - workspace: full app snapshot
 * - user: single-user snapshot
 */
export type BackupScope = 'workspace' | 'user';

/* ───────────────────────── ROOT CONTRACT ───────────────────────── */
/**
 * Root Quilix backup contract.
 * This is the ONLY valid backup format.
 */
export interface QuilixBackup {
  app: 'Quilix';
  version: AnyBackupVersion;
  scope: BackupScope;
  exportedAt: number;
  meta: BackupMeta;
  data: BackupData;
}

/* ───────────────────────── DATA PAYLOAD ───────────────────────── */
/**
 * Container for all persisted entities.
 * Optional fields allow partial backups and future expansion.
 */
export interface BackupData {
  users?: User[];
  session?: Session | null;

  // Future IndexedDB entities
  tasks?: unknown[];
  notes?: unknown[];
  boards?: unknown[];
  progress?: unknown[];
}

/* ───────────────────────── METADATA ───────────────────────── */
/**
 * Backup metadata (non-domain, non-user data).
 * Used for validation, migration, and tooling.
 */
export interface BackupMeta {
  appVersion?: string;
  createdAt: number;

  migratedFromVersion?: number;
  migratedAt?: number;
}
