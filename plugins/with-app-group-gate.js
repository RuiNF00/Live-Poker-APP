// The App Group (group.com.ruinf.sweatbook) lets the Live Activity and the home widget read
// the session from the app. Registering it writes to the App IDs in the Apple account, so it is
// on only when app.json says so: "extra": { "appGroup": true }. That one committed value is read
// the same way by prebuild, an EAS build, `eas update` and the app itself (src/lib/lock-screen/index.tsx,
// through expo-constants), and it is part of the OTA runtime fingerprint, so a build and an update can
// never disagree about it (scripts/check-ota-runtime.mjs). No environment variable. Without it
// the iOS build is what the cable builds have been: no group in either entitlements file, no App
// Group reason (1C8F.1) in the privacy manifests, no Live Activity, and no home widget on iOS
// (left out in app.config.js, since it could never get data). expo-widgets always adds the group
// (falling back to group.<bundle id>), so this takes it out again once every file is written.
// Android is not touched.
const { withFinalizedMod } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('fs');
const path = require('path');

const GROUPS = 'com.apple.security.application-groups';
const WIDGET_TARGET = 'ExpoWidgetsTarget';

/** The App Group switch: app.json extra.appGroup, true to turn it on. Anything else is off. */
const appGroupOn = (config) => config?.extra?.appGroup === true;

/** The entitlements without any App Group. */
function withoutGroup(entitlements) {
  const out = { ...entitlements };
  delete out[GROUPS];
  return out;
}

/**
 * The privacy manifest without the App Group reason. Where 1C8F.1 was the only reason for
 * UserDefaults (the widget's own manifest), it becomes CA92.1: the target's own defaults.
 */
function withoutGroupReason(manifest) {
  const types = (manifest.NSPrivacyAccessedAPITypes ?? []).map((t) => {
    if (t.NSPrivacyAccessedAPIType !== 'NSPrivacyAccessedAPICategoryUserDefaults') return t;
    const reasons = (t.NSPrivacyAccessedAPITypeReasons ?? []).filter((r) => r !== '1C8F.1');
    return { ...t, NSPrivacyAccessedAPITypeReasons: reasons.length ? reasons : ['CA92.1'] };
  });
  return { ...manifest, NSPrivacyAccessedAPITypes: types };
}

/** EAS's credentials step reads the widget's entitlements from here (expo-widgets fills it in). */
function withoutEasGroup(config) {
  const exts = config.extra?.eas?.build?.experimental?.ios?.appExtensions;
  if (!exts) return config;
  for (const ext of exts) if (ext.entitlements) ext.entitlements = withoutGroup(ext.entitlements);
  return config;
}

/**
 * Plugin list for app.config.js: without the group the home widget can never get data on iOS,
 * so it leaves the iOS widget gallery (expo-widgets skips widgets with `ios: null`). The widget
 * target stays, with the Live Activity only, and Android keeps its widget.
 */
function withoutIosWidgets(plugins) {
  return plugins.map((p) => {
    if (!Array.isArray(p) || p[0] !== 'expo-widgets') return p;
    return [p[0], { ...p[1], widgets: (p[1]?.widgets ?? []).map((w) => ({ ...w, ios: null })) }];
  });
}

function rewrite(file, change) {
  if (!fs.existsSync(file)) return;
  fs.writeFileSync(file, plist.build(change(plist.parse(fs.readFileSync(file, 'utf8')))));
}

const withAppGroupGate = (config) => {
  if (appGroupOn(config)) return config;
  // Listed after expo-widgets in app.json, so its EAS entry is already there.
  config = withoutEasGroup(config);
  return withFinalizedMod(config, [
    'ios',
    (config) => {
      const root = config.modRequest.platformProjectRoot;
      const app = path.join(root, config.modRequest.projectName);
      rewrite(path.join(app, `${config.modRequest.projectName}.entitlements`), withoutGroup);
      rewrite(path.join(root, WIDGET_TARGET, `${WIDGET_TARGET}.entitlements`), withoutGroup);
      rewrite(path.join(app, 'PrivacyInfo.xcprivacy'), withoutGroupReason);
      rewrite(path.join(root, WIDGET_TARGET, 'PrivacyInfo.xcprivacy'), withoutGroupReason);
      return config;
    },
  ]);
};

module.exports = withAppGroupGate;
module.exports.appGroupOn = appGroupOn;
module.exports.withoutGroup = withoutGroup;
module.exports.withoutGroupReason = withoutGroupReason;
module.exports.withoutEasGroup = withoutEasGroup;
module.exports.withoutIosWidgets = withoutIosWidgets;
