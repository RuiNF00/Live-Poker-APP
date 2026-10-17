// Reading the text on a receipt photo, on the phone: Apple Vision on iOS,
// ML Kit on Android (expo-text-extractor). The photo never leaves the phone.
// The module only exists in a development or store build; in Expo Go and on
// the web there is nothing to read with, and the receipt goes to the form.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface TextExtractor {
  isSupported: boolean;
  extractTextFromImage(path: string): Promise<string[]>;
}

const mod = Platform.OS === 'web' ? null : requireOptionalNativeModule<TextExtractor>('ExpoTextExtractor');

export const canReadReceipts = !!mod?.isSupported;

/** The lines found in the photo; null when it couldn't be read here. */
export async function readReceiptText(uri: string): Promise<string[] | null> {
  if (!mod || !canReadReceipts) return null;
  try {
    return await mod.extractTextFromImage(uri.replace('file://', ''));
  } catch {
    return null;
  }
}
