import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { shareLink, uploadHand } from '@/lib/share-api';
import { forumText } from '@/poker/text';
import type { Hand } from '@/poker/types';
import { handShareText } from '@/share/share-text';

const KEY = 'sweatbook.sample.share.v1';

/**
 * Share the sample hand: one public link, made once and reused. Never counts towards
 * the free share limit and never lands in the hand list. Offline, it shares the text.
 */
export async function shareSampleHand(hand: Hand): Promise<void> {
  let message: string;
  try {
    let id = await AsyncStorage.getItem(KEY).catch(() => null);
    if (!id) {
      id = (await uploadHand(hand, { names: false, notes: true })).id;
      AsyncStorage.setItem(KEY, id).catch(() => {});
    }
    message = `${handShareText(undefined, 'link')}\n${shareLink(id, 'link')}`;
  } catch {
    message = forumText(hand, { brand: true, notes: true });
  }
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(message);
    notice(t('Link copiado'));
  } else await Share.share({ message });
}
