//src/services/scanSyncService.ts

import NetInfo from '@react-native-community/netinfo';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../lib/supabase';

import {
  getPendingScans,
  markScanSyncing,
  markScanSynced,
  markScanSyncError,
  type SavedSkinScan,
} from './skinAnalysisStorage';

const BUCKET_NAME = 'skin-scans';

let syncInProgress = false;

export interface SyncSummary {
  attempted: number;
  synced: number;
  failed: number;
  offline: boolean;
}

function isUuid(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function validateScan(scan: SavedSkinScan): void {
  if (!isUuid(scan.id)) {
    throw new Error(
      'This local scan has an unsupported ID format. It remains available on this device but cannot be synchronized.',
    );
  }

  if (!isUuid(scan.resultId)) {
    throw new Error(
      'The scan result ID is invalid. The scan must be saved again before synchronization.',
    );
  }

  if (!scan.analysis) {
    throw new Error('This scan has no analysis result to synchronize.');
  }

  if (!scan.ownerUserId) {
    throw new Error(
      'This scan is not assigned to an account and cannot be synchronized.',
    );
  }
}

function getMimeType(uri: string): string {
  const cleanUri = uri.split('?')[0].toLowerCase();

  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';

  return 'image/jpeg';
}

function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;

  if (!user) {
    throw new Error('Sign in to synchronize your skin scans.');
  }

  return user;
}

async function verifyUserProfile(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'Your user profile was not found. Complete profile setup before synchronizing scans.',
    );
  }
}

async function uploadPhoto(
  scan: SavedSkinScan,
  userId: string,
): Promise<string> {
  const photo = new File(scan.photoUri);

  if (!photo.exists) {
    throw new Error(`Local photograph is missing for scan ${scan.id}.`);
  }

  const mimeType = getMimeType(scan.photoUri);
  const extension = getFileExtension(mimeType);
  const objectPath = `${userId}/${scan.id}.${extension}`;

  const base64 = await photo.base64();
  const fileData = decode(base64);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(objectPath, fileData, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) throw error;

  return objectPath;
}

async function uploadScanRecords(
  scan: SavedSkinScan,
  userId: string,
  imagePath: string,
): Promise<void> {
  const analysis = scan.analysis;

  if (!analysis) {
    throw new Error('This scan has no analysis result to synchronize.');
  }

  const { error: scanError } = await supabase
    .from('scans')
    .upsert(
      {
        id: scan.id,
        user_id: userId,
        image_path: imagePath,
        status: 'completed',
        model_version: analysis.model ?? analysis.provider ?? null,
        created_at: scan.createdAt,
      },
      {
        onConflict: 'id',
      },
    );

  if (scanError) throw scanError;

  const { error: resultError } = await supabase
    .from('scan_results')
    .upsert(
      {
        id: scan.resultId,
        scan_id: scan.id,
        condition_label:
          analysis.skinType ??
          (analysis.analysisMode === 'texture'
            ? 'Texture demonstration'
            : 'Skin analysis demonstration'),
        // This prototype score is not a calibrated model confidence.
        confidence: null,
        scores: {
          overallScore: analysis.overallScore ?? null,
          metrics: analysis.metrics ?? [],
        },
        skin_metrics: {
          skinType: analysis.skinType ?? null,
          hydration: analysis.hydration ?? null,
          skinHealth: analysis.skinHealth ?? null,
          analysisMode: analysis.analysisMode ?? null,
          textureArea: analysis.textureArea ?? null,
          summary: analysis.summary,
          concerns: analysis.concerns ?? [],
          recommendations: analysis.recommendations ?? [],
          provider: analysis.provider ?? null,
          model: analysis.model ?? null,
        },
        created_at: scan.createdAt,
      },
      {
        onConflict: 'id',
      },
    );

  if (resultError) throw resultError;
}

async function synchronizeOneScan(
  scan: SavedSkinScan,
  userId: string,
): Promise<void> {
  // Validate before uploading anything to Storage.
  validateScan(scan);

  if (scan.ownerUserId !== userId) {
    throw new Error(
      'This scan belongs to a different account and cannot be synchronized.',
    );
  }

  await markScanSyncing(scan.id);

  try {
    const imagePath = await uploadPhoto(scan, userId);

    await uploadScanRecords(scan, userId, imagePath);

    await markScanSynced(scan.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown synchronization error.';

    await markScanSyncError(scan.id, message);

    throw error;
  }
}

export async function syncPendingScans(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    attempted: 0,
    synced: 0,
    failed: 0,
    offline: false,
  };

  if (syncInProgress) {
    return summary;
  }

  syncInProgress = true;

  try {
    const network = await NetInfo.fetch();

    const connected =
      network.isConnected === true &&
      network.isInternetReachable !== false;

    if (!connected) {
      summary.offline = true;
      return summary;
    }

    const user = await getAuthenticatedUser();

    // Only retrieve scans owned by the currently authenticated account.
    const pendingScans = await getPendingScans(user.id);

    if (pendingScans.length === 0) {
      return summary;
    }

    summary.attempted = pendingScans.length;

    await verifyUserProfile(user.id);

    for (const scan of pendingScans) {
      try {
        await synchronizeOneScan(scan, user.id);
        summary.synced += 1;
      } catch (error) {
        summary.failed += 1;

        console.warn(
          `Scan synchronization failed (${scan.id}):`,
          error,
        );
      }
    }

    return summary;
  } catch (error) {
    console.warn('Scan synchronization could not start:', error);

    // If the user/profile check failed before individual attempts,
    // report the failure without claiming any scan was synchronized.
    if (summary.attempted === 0) {
      summary.failed = 1;
    } else {
      summary.failed += summary.attempted - summary.synced - summary.failed;
    }

    return summary;
  } finally {
    syncInProgress = false;
  }
}

/**
 * Starts an initial synchronization and listens for connectivity changes.
 * Call once from a mounted application screen.
 */
export function startScanSyncListener(): () => void {
  void syncPendingScans();

  const unsubscribe = NetInfo.addEventListener(state => {
    const connected =
      state.isConnected === true &&
      state.isInternetReachable !== false;

    if (connected) {
      void syncPendingScans();
    }
  });

  return unsubscribe;
}
