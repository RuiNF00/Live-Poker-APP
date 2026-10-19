// Reading the text on a photo, on the phone: Apple Vision on iOS, ML Kit on
// Android (expo-text-extractor). The photo never leaves the phone. The module
// only exists in a development or store build; in Expo Go and on the web it is
// missing, never imported directly (that would throw), and the app says the
// feature comes with the store version.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { makeReader, type TextExtractor } from './receipt-ocr-core';

const reader = makeReader(() => (Platform.OS === 'web' ? null : requireOptionalNativeModule<TextExtractor>('ExpoTextExtractor')));

export const canReadReceipts = reader.available;
export const readReceiptText = reader.read;
