// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // React Compiler advisories. Live clocks read Date.now() in render on purpose and
    // a few sheets sync props into state; kept visible as warnings, not CI blockers.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Startup size: the root icon import pulls every icon set (~1 MB of JS) and
    // RevenueCat is ~1 MB that billing/purchases.ts loads on first use only.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@expo/vector-icons', message: "Import one set: import Ionicons from '@expo/vector-icons/Ionicons'." },
            { name: 'react-native-purchases', message: 'Go through src/billing/purchases.ts, which loads RevenueCat on first use.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/billing/purchases.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: ['dist/*', 'web/*', 'packages/*', 'landing/*', 'store/*', 'supabase/*', '.claude/*'],
  },
]);
