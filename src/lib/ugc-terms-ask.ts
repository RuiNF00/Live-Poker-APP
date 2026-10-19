// The «Aceito» sheet for ugc-terms: a system alert, so it shows over any screen or modal.
// «Ler os termos» opens them and asks again on the next tap; only «Aceito» is remembered.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';

import { legalUrl } from '@/billing/disclosure';
import { t, variant } from '@/i18n';
import { onEraseAll } from './erase-hooks';
import { ugcTerms } from './ugc-terms';

const gate = ugcTerms(AsyncStorage);

gate.setAsker(
  () =>
    new Promise<boolean>((resolve) => {
      const title = t('Antes de publicares');
      const body = t('Comentários, mãos partilhadas e o perfil público ficam à vista de outras pessoas. Ao continuar, aceitas os Termos de utilização: não há tolerância para conteúdo ofensivo nem para quem abusa de outras pessoas. Removemos esse conteúdo e afastamos quem o publica.');
      if (Platform.OS === 'web') {
        resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}\n\n${legalUrl('terms', variant)}`));
        return;
      }
      Alert.alert(
        title,
        body,
        [
          { text: t('Ler os termos'), onPress: () => (resolve(false), void WebBrowser.openBrowserAsync(legalUrl('terms', variant)).catch(() => {})) },
          { text: t('Agora não'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('Aceito'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    }),
);

onEraseAll(() => gate.forget());

/** Before the first comment, public hand link or public profile: true once the player tapped «Aceito». */
export const acceptUgcTerms = () => gate.accept();
