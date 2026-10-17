// Files left in the cache by import and "Enviar ao suporte". Kept apart from
// support-mail so erase-all doesn't pull the mail composer into every screen.

import { Directory, File, Paths } from 'expo-file-system';

/** "Delete all my data": every file the app left in the cache (exports, backups, support copies, videos), the files picked for import, and anything with the player's face or voice. */
export function dropSupportCopies(): void {
  try {
    // Everything the app writes there is named sweatbook-*: backups and CSV/PDF exports (the whole
    // history, notes included), solver files, import copies, and hand videos and stories (face, voice).
    // react-native-view-shot's story and post images (results on them) go there too on Android.
    for (const f of new Directory(Paths.cache).list()) if (f instanceof File && /^(sweatbook-|ReactNative-snapshot-image)/.test(f.name)) f.delete();
  } catch {}
  try {
    // On iOS view-shot writes them to the app's tmp/ReactNative instead (Library/Caches → container → tmp).
    const d = new Directory(Paths.cache.parentDirectory.parentDirectory, 'tmp', 'ReactNative');
    if (d.exists) for (const f of d.list()) if (f instanceof File) f.delete();
  } catch {}
  try {
    // expo-document-picker's copyToCacheDirectory puts picked files here.
    const d = new Directory(Paths.cache, 'DocumentPicker');
    if (d.exists) d.delete();
  } catch {}
  try {
    // expo-image-picker's camera clips and photos (the face clip for hand videos among them).
    const d = new Directory(Paths.cache, 'ImagePicker');
    if (d.exists) d.delete();
  } catch {}
}
