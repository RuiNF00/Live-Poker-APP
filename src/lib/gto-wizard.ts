// One tap from a hand (or a selection of hands) to GTO Wizard: copy, open, paste.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Platform } from 'react-native';

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';

import { GTOW_UPLOADS_URL, gtowPayload } from './gtow-core';

const SEEN_KEY = 'sweatbook.gtow.seen.v1';

function say(title: string, body: string, buttons?: { text: string; onPress?: () => void; style?: 'cancel' }[]) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
  } else Alert.alert(title, body, buttons);
}

/**
 * Copies the finished hands in PokerStars format and opens GTO Wizard's uploads page.
 * The first time it says where to paste; after that one tap goes straight there.
 */
export async function openInGtoWizard(hands: Hand[]): Promise<void> {
  const { text, sent, skipped } = gtowPayload(hands);
  if (!sent) {
    say(t('Mão por completar'), t('O GTO Wizard só lê mãos completas. Acaba a mão primeiro.'));
    return;
  }
  await Clipboard.setStringAsync(text);
  const open = () => Linking.openURL(GTOW_UPLOADS_URL).catch(() => say(t('Não deu'), t('Não conseguimos abrir o GTO Wizard.')));
  const left = skipped ? ' ' + (skipped === 1 ? t('1 mão por completar ficou de fora.') : t('{n} mãos por completar ficaram de fora.', { n: skipped })) : '';
  const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => '1');
  if (seen && !left) return void open();
  AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  say(
    sent === 1 ? t('Mão copiada') : t('{n} mãos copiadas', { n: sent }),
    t('No GTO Wizard, em Analyze › Upload, cola o texto e carrega em Upload.') + left,
    [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Abrir GTO Wizard'), onPress: open },
    ],
  );
}
