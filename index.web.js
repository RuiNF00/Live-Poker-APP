// Web: fetch the visitor's language file first, then start the app, so text
// computed when modules load (plan names, hand ranks) is already translated.
// Expo first: it installs the loader that import() uses to fetch the language file.
// Without it, a language picked in Settings never loads and the app stays in Portuguese.
import 'expo';
import { i18nReady } from './src/i18n';

i18nReady.finally(() => {
  require('expo-router/entry');
});
