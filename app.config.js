// app.json holds the config. This file refuses the local-Pro flag in an EAS
// build: EXPO_PUBLIC_LOCAL_PRO is for the Release build installed by cable on a
// test iPhone (src/billing/dev-pro.ts), never for a store build. And without
// the App Group (EXPO_PUBLIC_APP_GROUP=1) the iOS home widget is left out, as it
// could never show anything (plugins/with-app-group-gate.js).
const { appGroupOn, withoutIosWidgets } = require('./plugins/with-app-group-gate');

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD && process.env.EXPO_PUBLIC_LOCAL_PRO) {
    throw new Error('EXPO_PUBLIC_LOCAL_PRO is only for local test builds. Remove it before an EAS build.');
  }
  if (!appGroupOn()) config = { ...config, plugins: withoutIosWidgets(config.plugins ?? []) };
  return config;
};
