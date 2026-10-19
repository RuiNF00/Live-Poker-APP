// A one-line confirmation ("Link copiado") that also shows on the web build:
// react-native-web's Alert.alert does nothing, so the web gets window.alert.

import { Alert, Platform } from 'react-native';

export function notice(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}
