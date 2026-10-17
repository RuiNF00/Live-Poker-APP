// Web: fetch the visitor's language file first, then start the app, so text
// computed when modules load (plan names, hand ranks) is already translated.
import { i18nReady } from './src/i18n';

i18nReady.finally(() => {
  require('expo-router/entry');
});
