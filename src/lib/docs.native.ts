// Receipts and tax forms attached to a session: a photo from the camera or
// the library, or any file (PDF of a W-2G). Copied next to the app's data,
// not the cache the system may clear; the session keeps only the file name.

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';

export type DocSource = 'camera' | 'photos' | 'files';

const dir = () => new Directory(Paths.document, 'docs');

function ext(name: string, fallback: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : fallback;
}

/** null when the user cancels or says no to the camera. */
export async function pickDoc(source: DocSource, id: string): Promise<{ file: string; name: string } | null> {
  let uri: string;
  let name: string;
  if (source === 'files') {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return null;
    uri = r.assets[0].uri;
    name = r.assets[0].name;
  } else {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return null;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return null;
    uri = r.assets[0].uri;
    name = r.assets[0].fileName ?? 'foto.jpg';
  }
  const d = dir();
  d.create({ idempotent: true, intermediates: true });
  const file = `${id}.${ext(name, 'jpg')}`;
  await new File(uri).copy(new File(d, file), { overwrite: true });
  return { file, name };
}

/** Where the file is, to show it or read the text on it. */
export function docUri(file: string): string {
  return new File(dir(), file).uri;
}

/** False when the file was attached on another phone (a restored backup). */
export function docExists(file: string): boolean {
  try {
    return new File(dir(), file).exists;
  } catch {
    return false;
  }
}

/** Opens the share sheet, from where it can be viewed, printed or sent to an accountant. */
export async function openDoc(file: string, name: string): Promise<void> {
  await Sharing.shareAsync(new File(dir(), file).uri, { dialogTitle: name });
}

export function dropDoc(file: string) {
  try {
    const f = new File(dir(), file);
    if (f.exists) f.delete();
  } catch {}
}

/** "Delete all my data": every receipt and tax form on this phone. */
export function dropAllDocs(): void {
  try {
    const d = dir();
    if (d.exists) d.delete();
  } catch {}
}
