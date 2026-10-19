// One card image to the system share sheet, for X, WhatsApp, Messages or
// Photos. The link goes to the clipboard: most apps drop text that comes with
// an image, so the player pastes it.

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import { t } from '@/i18n';

export const canShareImage = true;

export async function shareImage(file: string, link: string): Promise<void> {
  await Clipboard.setStringAsync(link).catch(() => {});
  await Sharing.shareAsync(file, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('Partilhar imagem') });
}
