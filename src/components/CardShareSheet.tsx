// The share sheet for the card screens (hand story, session, festival,
// carousel, month, year): Instagram, WhatsApp, X, copy link and the other apps,
// on the shared ShareSheet the hand screen uses (same order, last used first).

import React from 'react';

import { t } from '@/i18n';

import { ShareSheet, type ShareOption } from './ShareSheet';

// Long enough for the sheet to close before Instagram or the system share sheet opens over it.
const AFTER_CLOSE_MS = 350;
const later = (fn: () => void) => () => void setTimeout(fn, AFTER_CLOSE_MS);

export function CardShareSheet({
  visible,
  onClose,
  instagram,
  instagramTitle,
  whatsapp,
  x,
  other,
  copy,
  copyTitle,
}: {
  visible: boolean;
  onClose: () => void;
  instagram?: () => void;
  instagramTitle?: string;
  whatsapp?: () => void;
  x?: () => void;
  other?: () => void;
  copy?: () => void;
  copyTitle?: string;
}) {
  const options: ShareOption[] = [];
  if (instagram) options.push({ key: 'instagram', icon: 'logo-instagram', label: instagramTitle ?? t('Story no Instagram'), onPress: later(instagram) });
  if (whatsapp) options.push({ key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', onPress: later(whatsapp) });
  if (x) options.push({ key: 'x', icon: 'logo-x', label: t('Publicar no X'), onPress: later(x) });
  if (copy) options.push({ key: 'copy', icon: 'link-outline', label: copyTitle ?? t('Copiar link'), onPress: copy });
  if (other) options.push({ key: 'other', icon: 'share-outline', label: t('Outras apps'), sub: t('Mensagens, Telegram…'), onPress: later(other) });
  return <ShareSheet visible={visible} onClose={onClose} groups={[{ options }]} />;
}
