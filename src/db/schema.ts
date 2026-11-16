import type { Database } from '../types/database';

type Tables = Database['public']['Tables'];

export type ProfileRow = Tables['profiles']['Row'];
export type ProfileInsert = Tables['profiles']['Insert'];
export type ProfileUpdate = Tables['profiles']['Update'];

export type ScanRow = Tables['scans']['Row'];
export type ScanInsert = Tables['scans']['Insert'];
export type ScanUpdate = Tables['scans']['Update'];

export type ScanResultRow = Tables['scan_results']['Row'];
export type ScanResultInsert = Tables['scan_results']['Insert'];
export type ScanResultUpdate = Tables['scan_results']['Update'];

export type ScanWithResult = {
  scan: ScanRow;
  result: ScanResultRow | null;
};

export interface CreateScanInput {
  userId: string;
  imagePath: string;
  modelVersion?: string;
  status?: 'pending' | 'processing' | 'done' | 'failed';
}

export interface SaveScanResultInput {
  scanId: string;
  conditionLabel?: string | null;
  confidence?: number | null;
  scores?: ScanResultRow['scores'];
  skinMetrics?: ScanResultRow['skin_metrics'];
}
