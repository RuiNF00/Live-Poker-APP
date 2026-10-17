// Web preview: attachments live in memory for this tab only (the phone app
// keeps them on disk).

import * as DocumentPicker from 'expo-document-picker';

export type DocSource = 'camera' | 'photos' | 'files';

const urls = new Map<string, string>();

export async function pickDoc(_source: DocSource, id: string): Promise<{ file: string; name: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  urls.set(id, a.file ? URL.createObjectURL(a.file) : a.uri);
  return { file: id, name: a.name };
}

export function docUri(file: string): string {
  return urls.get(file) ?? '';
}

export function docExists(file: string): boolean {
  return urls.has(file);
}

export async function openDoc(file: string, _name?: string): Promise<void> {
  const u = urls.get(file);
  if (u) window.open(u, '_blank');
}

export function dropDoc(file: string) {
  const u = urls.get(file);
  if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
  urls.delete(file);
}

/** "Delete all my data": forget this tab's attachments. */
export function dropAllDocs(): void {
  for (const u of urls.values()) if (u.startsWith('blob:')) URL.revokeObjectURL(u);
  urls.clear();
}
