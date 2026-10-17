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
    ignores: ['dist/*', 'web/*', 'packages/*', 'landing/*', 'store/*', 'supabase/*', '.claude/*'],
  },
]);
