// Files left in the cache by import and "Enviar ao suporte". Kept apart from
// support-mail so erase-all doesn't pull the mail composer into every screen.

import { Directory, File, Paths } from 'expo-file-system';

/** "Delete all my data": the copies made for support and the files picked for import. */
export function dropSupportCopies(): void {
  try {
    for (const f of new Directory(Paths.cache).list()) if (f instanceof File && f.name.startsWith('sweatbook-importacao-')) f.delete();
  } catch {}
  try {
    // expo-document-picker's copyToCacheDirectory puts picked files here.
    const d = new Directory(Paths.cache, 'DocumentPicker');
    if (d.exists) d.delete();
  } catch {}
}
