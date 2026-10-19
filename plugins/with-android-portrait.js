// Phones only, in portrait. With target 36, Android 16 ignores screenOrientation and fixed
// resizability on screens 600 dp wide or more, which takes in the inner screen of a foldable
// (Play counts foldables as phones; tablets are excluded in the device catalog). This property
// is Android 16's temporary opt-out, which keeps the app in portrait there. It stops working
// with target 37, so by then every screen has to hold up in landscape.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const NAME = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';

/** Adds the property to <application> once; returns the manifest. */
function addPortraitProperty(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.property = (app.property ?? []).filter((p) => p.$['android:name'] !== NAME);
  app.property.push({ $: { 'android:name': NAME, 'android:value': 'true' } });
  return manifest;
}

const withAndroidPortrait = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = addPortraitProperty(c.modResults);
    return c;
  });

module.exports = withAndroidPortrait;
module.exports.addPortraitProperty = addPortraitProperty;
