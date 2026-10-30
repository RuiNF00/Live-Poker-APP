// Web: fetch the visitor's language file first, then start the app, so text
// computed when modules load (plan names, hand ranks) is already translated.
// Expo first: it installs the loader that import() uses to fetch the language file.
// Without it, a language picked in Settings never loads and the app stays in Portuguese.
import 'expo';
import { i18nReady } from './src/i18n';
// Noite or Dia is set before any module reads a colour.
import './src/lib/appearance';

i18nReady.finally(() => {
  require('expo-router/entry');
});
