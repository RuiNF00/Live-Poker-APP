// How big a picked file may be. Files are read whole into memory, so a video picked by mistake
// must stop before it closes the app; but the app's own «Cópia completa» has to come back in:
// 20 000 hands with notes and 2 000 sessions are a 21 MB file, which the old single 20 MB limit
// refused on a new phone.

/** Any file read in: a Sweatbook backup (.json) of years of hands fits with room to spare. */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
/** A spreadsheet from another app: read row by row into sessions, which this many bytes already takes a while. */
export const MAX_CSV_BYTES = 20 * 1024 * 1024;
