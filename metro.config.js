// Metro with Sentry's source map debug ids, so a crash report from any build
// or OTA update points at our own file and line.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
