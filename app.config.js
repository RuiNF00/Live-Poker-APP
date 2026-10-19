// app.json holds the config. This file refuses the local-Pro flag in an EAS
// build: EXPO_PUBLIC_LOCAL_PRO is for the Release build installed by cable on a
// test iPhone (src/billing/dev-pro.ts), never for a store build. And without
// the App Group (app.json "extra": { "appGroup": true }) the iOS home widget is
// left out, as it could never show anything (plugins/with-app-group-gate.js).
const { appGroupOn, withoutIosWidgets } = require('./plugins/with-app-group-gate');

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD && process.env.EXPO_PUBLIC_LOCAL_PRO) {
    throw new Error('EXPO_PUBLIC_LOCAL_PRO is only for local test builds. Remove it before an EAS build.');
  }
  // The App Group used to be an environment variable; an env var a build has and `eas update` doesn't
  // gives them different runtimes, and the update reaches nobody. It is app.json's extra.appGroup now.
  if (process.env.EXPO_PUBLIC_APP_GROUP !== undefined) {
    throw new Error('EXPO_PUBLIC_APP_GROUP is no longer read. Turn the App Group on with "extra": { "appGroup": true } in app.json, and unset the variable.');
  }
  if (!appGroupOn(config)) config = { ...config, plugins: withoutIosWidgets(config.plugins ?? []) };
  return config;
};
