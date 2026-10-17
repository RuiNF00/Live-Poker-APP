// The share sheet for the card screens (hand story, session, festival,
// carousel, year): Instagram, X, the other apps and copy link, on the shared
// ShareSheet the hand screen uses.

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
  x,
  other,
  copy,
  copyTitle,
}: {
  visible: boolean;
  onClose: () => void;
  instagram?: () => void;
  instagramTitle?: string;
  x?: () => void;
  other?: () => void;
  copy?: () => void;
  copyTitle?: string;
}) {
  const options: ShareOption[] = [];
  if (instagram) options.push({ icon: 'logo-instagram', label: instagramTitle ?? t('Story no Instagram'), onPress: later(instagram) });
  if (x) options.push({ icon: 'logo-x', label: t('Post no X'), onPress: later(x) });
  if (other) options.push({ icon: 'share-outline', label: t('Outras apps'), sub: t('WhatsApp, Mensagens, guardar imagem…'), onPress: later(other) });
  if (copy) options.push({ icon: 'link-outline', label: copyTitle ?? t('Copiar link'), onPress: copy });
  return <ShareSheet visible={visible} onClose={onClose} groups={[{ options }]} />;
}
