// Straight into a chat app with the message written, one tap less than the system sheet.
// Without the app (or when it refuses), the system sheet with the same message.

import { Linking, Platform, Share } from 'react-native';

/** Messages (iMessage on the iPhone) opens a new message with only the recipient left to pick. Not on the web. */
export const canSendMessages = Platform.OS !== 'web';

export async function sendWhatsapp(message: string): Promise<void> {
  const text = encodeURIComponent(message);
  const url = Platform.OS === 'web' ? `https://wa.me/?text=${text}` : `whatsapp://send?text=${text}`;
  await Linking.openURL(url).catch(() => Share.share({ message }));
}

export async function sendMessages(message: string): Promise<void> {
  // iOS reads the body after "&" (there is no recipient); Android after "?".
  const url = `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
  await Linking.openURL(url).catch(() => Share.share({ message }));
}
