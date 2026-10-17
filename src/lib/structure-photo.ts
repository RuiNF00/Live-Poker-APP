// The printed structure sheet, photographed and read on the phone. Returns
// the text a player would paste into the structure sheet (tournament.tsx),
// so the one parser in poker/tourney.ts reads it. The photo isn't kept.

import * as ImagePicker from 'expo-image-picker';

import { structureText } from '@/import/structure-ocr';

import { canReadReceipts, readReceiptText } from './receipt-ocr';

export const canReadStructure = canReadReceipts;

/** null when cancelled or nothing could be read; '' never comes back. */
export async function photoStructure(source: 'camera' | 'photos' = 'camera'): Promise<string | null> {
  if (!canReadStructure) return null;
  if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const lines = await readReceiptText(r.assets[0].uri);
  const text = lines ? structureText(lines) : '';
  return text || null;
}
