
import type { SkinAnalysisResult } from './skinAnalysisStorage';

const API_URL = process.env.EXPO_PUBLIC_SKIN_ANALYSIS_API_URL;

export async function analyseSkinPhoto(
  photoUri: string,
): Promise<SkinAnalysisResult> {
  if (!API_URL) {
    throw new Error(
      'Skin analysis API is not configured. Your photograph can still be saved.',
    );
  }

  const formData = new FormData();

  formData.append('image', {
    uri: photoUri,
    name: 'skin-scan.jpg',
    type: 'image/jpeg',
  } as any);

  const response = await fetch(API_URL, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Skin analysis service returned HTTP ${response.status}.`,
    );
  }

  const result = await response.json();

  if (
    typeof result.summary !== 'string' ||
    result.summary.trim().length === 0
  ) {
    throw new Error(
      'The analysis service returned an invalid response.',
    );
  }

  return {
    ...result,
    provider: result.provider ?? 'External AI service',
  } as SkinAnalysisResult;
}
