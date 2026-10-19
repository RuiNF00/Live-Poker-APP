// Sending a new swap's link: the same Partilhar sheet as everywhere else (last used first).
// When the last one was WhatsApp, the create button goes straight there, one tap fewer at the table.

import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Linking, Platform, Share } from 'react-native';

import { ShareSheet, type ShareOption } from '@/components/ShareSheet';
import { T } from '@/components/ui';
import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { lastShare } from '@/lib/share-last';
import { C } from '@/theme';

export interface SwapLink {
  url: string;
  message: string;
  /** Pair: send it only to them. Group: the group chat. */
  to?: string;
}

/** Straight to WhatsApp's chat picker, from the create button. */
export const sendsToWhatsapp = () => Platform.OS !== 'web' && lastShare() === 'whatsapp';

export async function sendWhatsapp(message: string) {
  const text = encodeURIComponent(message);
  await Linking.openURL(`whatsapp://send?text=${text}`).catch(() => Share.share({ message }));
}

/** The sheet closes before the chosen app opens (ShareSheet), so `onDone` runs once, on close. */
export function SwapSend({ link, onDone }: { link: SwapLink | null; onDone: () => void }) {
  const options: ShareOption[] = link
    ? [
        { key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', onPress: () => void sendWhatsapp(link.message) },
        {
          key: 'copy',
          icon: 'copy-outline',
          label: t('Copiar link'),
          onPress: () =>
            void Clipboard.setStringAsync(link.url)
              .then(() => notice(t('Link copiado'), link.url))
              .catch(() => {}),
        },
        { key: 'other', icon: 'share-outline', label: t('Outras apps'), sub: t('Mensagens, Telegram…'), onPress: () => void Share.share({ message: link.message }).catch(() => {}) },
      ]
    : [];
  return (
    <ShareSheet
      visible={!!link}
      title={t('Enviar o link')}
      onClose={onDone}
      header={link?.to ? <T v="small" color={C.textDim}>{link.to}</T> : null}
      groups={[{ options }]}
    />
  );
}
