// Web: the recording stays where the browser put it, for this visit only.

export async function keepVoiceNote(recording: string, _handId: string): Promise<string> {
  return recording;
}

export function voiceNoteExists(uri: string): boolean {
  return uri.startsWith('blob:') || uri.startsWith('data:');
}

export function dropVoiceNote(_uri: string | undefined) {}
