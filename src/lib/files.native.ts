// Native: write the file to the cache and open the share sheet (Files, Drive,
// email…); pick a file with the system document picker.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { decodeText } from '@/import/decode';

export async function saveTextFile(name: string, text: string, mime: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  // CSV: a byte-order mark, or Excel reads the accents (ç, ã, ñ) as the wrong letters.
  f.write(mime === 'text/csv' ? '\uFEFF' + text : text);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name, UTI: mime === 'text/csv' ? 'public.comma-separated-values-text' : mime === 'text/plain' ? 'public.plain-text' : 'public.json' });
}

// Read whole into memory: a video picked by mistake would close the app. No export or backup comes near this.
const MAX_TEXT_BYTES = 20 * 1024 * 1024;

/** null when the user cancels. */
export async function pickTextFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  if ((r.assets[0].size ?? 0) > MAX_TEXT_BYTES) throw new Error('too_big');
  return new File(r.assets[0].uri).text();
}

/** Like pickTextFile, with the file's own name and where the picked copy is (to attach it as it was). */
export async function pickTextFileWithName(): Promise<{ text: string; name: string; uri: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  // An .xlsx or a PDF isn't text: keep the file anyway, so it can go to support as it is.
  // Read as bytes: Excel's CSV is often Windows-1252 or UTF-16, which text() would garble.
  const text = (a.size ?? 0) > MAX_TEXT_BYTES ? '' : await new File(a.uri).bytes().then((b) => decodeText(b).text, () => '');
  return { text, name: a.name, uri: a.uri };
}
