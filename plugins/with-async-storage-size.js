// AsyncStorage on Android caps its whole database at 6 MB by default, about
// 6,000 hands. Past that every save fails. Raise the cap; the data is small
// JSON and lives in the app's private storage.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'AsyncStorage_db_size_in_MB';

module.exports = function withAsyncStorageSize(config, { sizeMB = 100 } = {}) {
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    c.modResults.push({ type: 'property', key: KEY, value: String(sizeMB) });
    return c;
  });
};
