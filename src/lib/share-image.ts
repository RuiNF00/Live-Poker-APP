// Web build: no share sheet for a captured card; the screens show the
// "open the app" line instead. The real one is share-image.native.ts.

export const canShareImage = false;

export async function shareImage(_file: string, _link: string): Promise<void> {}
