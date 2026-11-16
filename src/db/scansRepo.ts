import { supabase } from '../lib/supabase';
import type {
  CreateScanInput,
  SaveScanResultInput,
  ScanRow,
  ScanResultRow,
  ScanWithResult,
} from './schema';

export async function createScan(
  input: CreateScanInput,
): Promise<ScanRow> {
  const { data, error } = await supabase
    .from('scans')
    .insert({
      user_id: input.userId,
      image_path: input.imagePath,
      model_version: input.modelVersion ?? null,
      status: input.status ?? 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScanStatus(
  scanId: string,
  status: 'pending' | 'processing' | 'done' | 'failed',
  modelVersion?: string,
): Promise<ScanRow> {
  const update = modelVersion
    ? { status, model_version: modelVersion }
    : { status };

  const { data, error } = await supabase
    .from('scans')
    .update(update)
    .eq('id', scanId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveScanResult(
  input: SaveScanResultInput,
): Promise<ScanResultRow> {
  const { data, error } = await supabase
    .from('scan_results')
    .upsert(
      {
        scan_id: input.scanId,
        condition_label: input.conditionLabel ?? null,
        confidence: input.confidence ?? null,
        scores: input.scores ?? null,
        skin_metrics: input.skinMetrics ?? null,
      },
      { onConflict: 'scan_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserScans(
  userId: string,
  limit = 50,
): Promise<ScanRow[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getScanWithResult(
  scanId: string,
): Promise<ScanWithResult | null> {
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .maybeSingle();

  if (scanError) throw scanError;
  if (!scan) return null;

  const { data: result, error: resultError } = await supabase
    .from('scan_results')
    .select('*')
    .eq('scan_id', scanId)
    .maybeSingle();

  if (resultError) throw resultError;

  return {
    scan,
    result: result as ScanResultRow | null,
  };
}

export async function getUserScanHistory(
  userId: string,
  limit = 50,
): Promise<ScanWithResult[]> {
  const scans = await getUserScans(userId, limit);

  if (scans.length === 0) return [];

  const scanIds = scans.map((scan) => scan.id);

  const { data: results, error } = await supabase
    .from('scan_results')
    .select('*')
    .in('scan_id', scanIds);

  if (error) throw error;

  const resultsByScanId = new Map(
    (results ?? []).map((result) => [result.scan_id, result]),
  );

  return scans.map((scan) => ({
    scan,
    result: resultsByScanId.get(scan.id) ?? null,
  }));
}

export async function deleteScan(scanId: string): Promise<void> {
  // Delete the result first so this also works without ON DELETE CASCADE.
  const { error: resultError } = await supabase
    .from('scan_results')
    .delete()
    .eq('scan_id', scanId);

  if (resultError) throw resultError;

  const { error: scanError } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId);

  if (scanError) throw scanError;
}
