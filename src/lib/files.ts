// Web: save a text file as a download, pick one with the browser's file dialog.

import * as DocumentPicker from 'expo-document-picker';

export async function saveTextFile(name: string, text: string, mime: string): Promise<void> {
  // CSV: a byte-order mark, or Excel reads the accents (ç, ã, ñ) as the wrong letters.
  const url = URL.createObjectURL(new Blob([mime === 'text/csv' ? '\uFEFF' + text : text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** null when the user cancels. */
export async function pickTextFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return a.file ? a.file.text() : (await fetch(a.uri)).text();
}

/** Like pickTextFile, with the file's own name; on the web the picked file stays in memory (uri is a blob: URL). */
export async function pickTextFileWithName(): Promise<{ text: string; name: string; uri: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const text = await (a.file ? a.file.text() : (await fetch(a.uri)).text()).catch(() => '');
  return { text, name: a.name, uri: a.file ? URL.createObjectURL(a.file) : a.uri };
}
