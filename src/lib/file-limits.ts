// How big a picked file may be. Files are read whole into memory, so a video picked by mistake
// must stop before it closes the app; but the app's own «Cópia completa» has to come back in:
// 20 000 hands with notes and 2 000 sessions are a 21 MB file, which the old single 20 MB limit
// refused on a new phone.

/** Any file read in: a Sweatbook backup (.json) of years of hands fits with room to spare. */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
/** A spreadsheet from another app: read row by row into sessions, which this many bytes already takes a while. */
export const MAX_CSV_BYTES = 20 * 1024 * 1024;

/** Bytes looked at before reading a big file in full. */
export const HEAD_BYTES = 64;

/**
 * Over the spreadsheet limit only a backup is worth reading in full, and a backup starts with «{»
 * (after a byte-order mark and spaces): anything else is turned away from its first bytes, before
 * tens of MB are read into memory.
 */
export function bigButNotBackup(size: number, head: Uint8Array): boolean {
  if (size <= MAX_CSV_BYTES) return false;
  let i = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x09 || head[i] === 0x0a || head[i] === 0x0d)) i++;
  return head[i] !== 0x7b;
}
