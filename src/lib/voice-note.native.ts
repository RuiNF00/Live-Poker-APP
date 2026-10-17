// Voice notes recorded at the table live next to the app's data, not in the
// cache the system may clear, one file per hand.

import { Directory, File, Paths } from 'expo-file-system';

/** Copies a fresh recording out of the cache; returns the file to keep on the hand. */
export async function keepVoiceNote(recording: string, handId: string): Promise<string> {
  const dir = new Directory(Paths.document, 'voice');
  dir.create({ idempotent: true, intermediates: true });
  const out = new File(dir, `${handId}.m4a`);
  await new File(recording).copy(out, { overwrite: true });
  return out.uri;
}

/** False when the note was recorded on another phone (a restored backup). */
export function voiceNoteExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function dropVoiceNote(uri: string | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}
