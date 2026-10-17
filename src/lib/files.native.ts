// Native: write the file to the cache and open the share sheet (Files, Drive,
// email…); pick a file with the system document picker.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveTextFile(name: string, text: string, mime: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name, UTI: mime === 'text/csv' ? 'public.comma-separated-values-text' : mime === 'text/plain' ? 'public.plain-text' : 'public.json' });
}

/** null when the user cancels. */
export async function pickTextFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  return new File(r.assets[0].uri).text();
}

/** Like pickTextFile, with the file's own name and where the picked copy is (to attach it as it was). */
export async function pickTextFileWithName(): Promise<{ text: string; name: string; uri: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  // An .xlsx or a PDF isn't text: keep the file anyway, so it can go to support as it is.
  const text = await new File(a.uri).text().catch(() => '');
  return { text, name: a.name, uri: a.uri };
}
