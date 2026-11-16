// src/services/skinAnalysisStorage.ts

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export interface SkinAnalysisResult {
  overallScore?: number;
  skinType?: string;
  hydration?: number;
  skinHealth?: string;
  summary: string;

  metrics?: {
    name: string;
    score: number;
    description: string;
    color: string;
    detail?: string;
  }[];

  concerns?: {
    name: string;
    level: string;
    color?: string;
    description?: string;
  }[];

  recommendations?: {
    step: string;
    title: string;
    description: string;
    category: string;
    time?: string;
  }[];

  provider?: string;
  model?: string;
  analysisMode?: 'overall' | 'texture';
  textureArea?: 'Cheeks' | 'Forehead' | 'Nose' | 'Chin';
  reportTitle?: string;
  reportSubtitle?: string;
}

export type ScanStatus = 'completed' | 'pending' | 'failed';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface SavedSkinScan {
  id: string;
  photoUri: string;
  createdAt: string;
  status: ScanStatus;
  analysis: SkinAnalysisResult | null;
  errorMessage?: string;

  resultId: string;
  ownerUserId: string | null;

  syncStatus: SyncStatus;
  syncError?: string;
  cloudSyncedAt?: string;
}

type ScanRow = {
  id: string;
  photo_uri: string;
  created_at: string;
  status: ScanStatus;
  analysis_json: string | null;
  error_message: string | null;
  result_id: string;
  owner_user_id: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  cloud_synced_at: string | null;
};

type SaveScanInput = Omit<
  SavedSkinScan,
  | 'resultId'
  | 'ownerUserId'
  | 'syncStatus'
  | 'syncError'
  | 'cloudSyncedAt'
> & {
  resultId?: string;
  ownerUserId?: string | null;
};

let database: SQLite.SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  const db = await SQLite.openDatabaseAsync('skin_analyzer.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS skin_scans (
      id TEXT PRIMARY KEY NOT NULL,
      photo_uri TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      analysis_json TEXT,
      error_message TEXT,
      result_id TEXT,
      owner_user_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_error TEXT,
      cloud_synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_skin_scans_created
    ON skin_scans(created_at DESC);
  `);

  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(skin_scans)',
  );

  const existingColumns = new Set(columns.map(column => column.name));

  const migrations: Array<[string, string]> = [
    ['result_id', 'ALTER TABLE skin_scans ADD COLUMN result_id TEXT'],
    ['owner_user_id', 'ALTER TABLE skin_scans ADD COLUMN owner_user_id TEXT'],
    [
      'sync_status',
      "ALTER TABLE skin_scans ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'",
    ],
    ['sync_error', 'ALTER TABLE skin_scans ADD COLUMN sync_error TEXT'],
    [
      'cloud_synced_at',
      'ALTER TABLE skin_scans ADD COLUMN cloud_synced_at TEXT',
    ],
  ];

  for (const [column, sql] of migrations) {
    if (!existingColumns.has(column)) {
      await db.execAsync(sql);
    }
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_skin_scans_owner_created
    ON skin_scans(owner_user_id, created_at DESC);
  `);

  // Generate stable result IDs for records created by older app versions.
  const missingResultIds = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM skin_scans
     WHERE result_id IS NULL OR result_id = ''`,
  );

  for (const row of missingResultIds) {
    await db.runAsync(
      'UPDATE skin_scans SET result_id = ? WHERE id = ?',
      Crypto.randomUUID(),
      row.id,
    );
  }

  // A previous app session may have stopped during an upload.
  // Return interrupted scans to the retry queue.
  await db.runAsync(
    `UPDATE skin_scans
     SET sync_status = 'pending',
         sync_error = 'Previous synchronization was interrupted.'
     WHERE sync_status = 'syncing'`,
  );

  database = db;
  return db;
}

function mapRow(row: ScanRow): SavedSkinScan {
  let analysis: SkinAnalysisResult | null = null;

  if (row.analysis_json) {
    try {
      analysis = JSON.parse(row.analysis_json) as SkinAnalysisResult;
    } catch {
      analysis = null;
    }
  }

  return {
    id: row.id,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    status: row.status,
    analysis,
    errorMessage: row.error_message ?? undefined,
    resultId: row.result_id,
    ownerUserId: row.owner_user_id ?? null,
    syncStatus: row.sync_status,
    syncError: row.sync_error ?? undefined,
    cloudSyncedAt: row.cloud_synced_at ?? undefined,
  };
}

const SELECT_SCAN_COLUMNS = `
  id,
  photo_uri,
  created_at,
  status,
  analysis_json,
  error_message,
  result_id,
  owner_user_id,
  sync_status,
  sync_error,
  cloud_synced_at
`;

export async function createScanId(): Promise<string> {
  return Crypto.randomUUID();
}

export async function savePhotoPermanently(
  temporaryUri: string,
  scanId: string,
): Promise<string> {
  const directory = new Directory(Paths.document, 'skin-scans');

  if (!directory.exists) {
    directory.create({
      idempotent: true,
      intermediates: true,
    });
  }

  const source = new File(temporaryUri);

  if (!source.exists) {
    throw new Error('The captured photograph could not be found.');
  }

  const destination = new File(directory, `${scanId}.jpg`);

  if (destination.exists) {
    destination.delete();
  }

  await source.copy(destination);

  return destination.uri;
}

export async function saveScan(scan: SaveScanInput): Promise<void> {
  const db = await getDatabase();
  const resultId = scan.resultId ?? Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO skin_scans (
      id,
      photo_uri,
      created_at,
      status,
      analysis_json,
      error_message,
      result_id,
      owner_user_id,
      sync_status,
      sync_error,
      cloud_synced_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL)
    ON CONFLICT(id) DO UPDATE SET
      photo_uri = excluded.photo_uri,
      created_at = excluded.created_at,
      status = excluded.status,
      analysis_json = excluded.analysis_json,
      error_message = excluded.error_message,
      result_id = excluded.result_id,
      sync_status = 'pending',
      sync_error = NULL,
      cloud_synced_at = NULL`,
    scan.id,
    scan.photoUri,
    scan.createdAt,
    scan.status,
    scan.analysis ? JSON.stringify(scan.analysis) : null,
    scan.errorMessage ?? null,
    resultId,
    scan.ownerUserId ?? null,
  );
}

export async function updateScanAnalysis(
  id: string,
  analysis: SkinAnalysisResult,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE skin_scans
     SET status = 'completed',
         analysis_json = ?,
         error_message = NULL,
         sync_status = 'pending',
         sync_error = NULL,
         cloud_synced_at = NULL
     WHERE id = ?`,
    JSON.stringify(analysis),
    id,
  );
}

export async function updateScanFailure(
  id: string,
  message: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE skin_scans
     SET status = 'failed',
         error_message = ?
     WHERE id = ?`,
    message,
    id,
  );
}

export async function getAllScans(): Promise<SavedSkinScan[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScanRow>(
    `SELECT ${SELECT_SCAN_COLUMNS}
     FROM skin_scans
     ORDER BY created_at DESC`,
  );

  return rows.map(mapRow);
}

export async function getScansForUser(
  userId: string,
): Promise<SavedSkinScan[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScanRow>(
    `SELECT ${SELECT_SCAN_COLUMNS}
     FROM skin_scans
     WHERE owner_user_id = ?
     ORDER BY created_at DESC`,
    userId,
  );

  return rows.map(mapRow);
}

export async function getScanById(
  id: string,
): Promise<SavedSkinScan | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ScanRow>(
    `SELECT ${SELECT_SCAN_COLUMNS}
     FROM skin_scans
     WHERE id = ?`,
    id,
  );

  return row ? mapRow(row) : null;
}

export async function getPendingScans(
  userId: string,
): Promise<SavedSkinScan[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScanRow>(
    `SELECT ${SELECT_SCAN_COLUMNS}
     FROM skin_scans
     WHERE owner_user_id = ?
       AND status = 'completed'
       AND analysis_json IS NOT NULL
       AND sync_status IN ('pending', 'error')
     ORDER BY created_at ASC`,
    userId,
  );

  return rows.map(mapRow);
}

export async function markScanSyncing(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE skin_scans
     SET sync_status = 'syncing',
         sync_error = NULL
     WHERE id = ?`,
    id,
  );
}

export async function markScanSynced(
  id: string,
  syncedAt = new Date().toISOString(),
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE skin_scans
     SET sync_status = 'synced',
         sync_error = NULL,
         cloud_synced_at = ?
     WHERE id = ?`,
    syncedAt,
    id,
  );
}

export async function markScanSyncError(
  id: string,
  message: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE skin_scans
     SET sync_status = 'error',
         sync_error = ?
     WHERE id = ?`,
    message,
    id,
  );
}

export async function deleteScan(id: string): Promise<void> {
  const db = await getDatabase();
  const scan = await getScanById(id);

  if (scan) {
    const photo = new File(scan.photoUri);

    if (photo.exists) {
      photo.delete();
    }
  }

  await db.runAsync(
    'DELETE FROM skin_scans WHERE id = ?',
    id,
  );
}
