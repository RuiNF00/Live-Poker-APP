// app.json holds the config. This file only refuses the local-Pro flag in an
// EAS build: EXPO_PUBLIC_LOCAL_PRO is for the Release build installed by cable
// on a test iPhone (src/billing/dev-pro.ts), never for a store build.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD && process.env.EXPO_PUBLIC_LOCAL_PRO) {
    throw new Error('EXPO_PUBLIC_LOCAL_PRO is only for local test builds. Remove it before an EAS build.');
  }
  return config;
};
