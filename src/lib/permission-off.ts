// A permission the player said no to: the system won't ask again, so a tap would
// otherwise do nothing. Say what's off and offer the phone's settings.

import { Alert, Linking, Platform } from 'react-native';

import { t } from '@/i18n';

export function permissionOff(what: 'camera' | 'microphone') {
  const [title, body] =
    what === 'camera'
      ? [t('Câmara desligada'), t('Ativa a câmara para o Sweatbook nas definições do telemóvel.')]
      : [t('Microfone desligado'), t('Ativa o microfone para o Sweatbook nas definições do telemóvel.')];
  // The browser has no settings to open and no native alert: a plain one says what's off.
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    return;
  }
  Alert.alert(title, body, [
    { text: t('Agora não'), style: 'cancel' },
    { text: t('Abrir Definições'), onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
}
