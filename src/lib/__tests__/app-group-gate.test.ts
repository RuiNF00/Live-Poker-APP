// Without app.json extra.appGroup an iOS build carries no App Group anywhere: entitlements,
// privacy manifests and the EAS credentials entry. One committed value, no environment variable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

type Ent = Record<string, unknown>;
type ApiType = { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] };
type Manifest = { NSPrivacyTracking?: boolean; NSPrivacyAccessedAPITypes?: ApiType[] };
type Config = { extra?: { eas?: { build?: { experimental?: { ios?: { appExtensions?: { targetName: string; entitlements?: Ent }[] } } } } } };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gate = require('../../../plugins/with-app-group-gate') as {
  appGroupOn: (config: { extra?: Record<string, unknown> } | undefined) => boolean;
  withoutGroup: (e: Ent) => Ent;
  withoutGroupReason: (m: Manifest) => Manifest;
  withoutEasGroup: (c: Config) => Config;
  withoutIosWidgets: (p: Plugin[]) => Plugin[];
};
type Plugin = string | [string, { widgets?: { name: string; ios?: object | null; android?: object }[]; enableAndroid?: boolean }];

const root = join(__dirname, '..', '..', '..');
const GROUPS = 'com.apple.security.application-groups';
const defaults = (reasons: string[]): ApiType => ({ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: reasons });

test('app group gate: on only with app.json extra.appGroup set to true', () => {
  assert.equal(gate.appGroupOn(undefined), false);
  assert.equal(gate.appGroupOn({}), false);
  assert.equal(gate.appGroupOn({ extra: { appGroup: false } }), false);
  assert.equal(gate.appGroupOn({ extra: { appGroup: 'true' } }), false);
  assert.equal(gate.appGroupOn({ extra: { appGroup: 1 } }), false);
  assert.equal(gate.appGroupOn({ extra: { appGroup: true } }), true);
});

test('app group gate: off in app.json, and the old variable stops the config instead of being ignored', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.extra.appGroup, false);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appConfig = require('../../../app.config.js') as (a: { config: typeof app }) => typeof app;
  const before = process.env.EXPO_PUBLIC_APP_GROUP;
  try {
    delete process.env.EXPO_PUBLIC_APP_GROUP;
    const off = appConfig({ config: app });
    const widgets = (off.plugins as Plugin[]).find((p) => Array.isArray(p) && p[0] === 'expo-widgets') as [string, { widgets: { ios?: object | null }[] }];
    assert.equal(widgets[1].widgets[0].ios, null);
    const on = appConfig({ config: { ...app, extra: { ...app.extra, appGroup: true } } });
    const widgetsOn = (on.plugins as Plugin[]).find((p) => Array.isArray(p) && p[0] === 'expo-widgets') as [string, { widgets: { ios?: object | null }[] }];
    assert.ok(widgetsOn[1].widgets[0].ios);
    process.env.EXPO_PUBLIC_APP_GROUP = '1';
    assert.throws(() => appConfig({ config: app }), /extra.*appGroup/);
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_APP_GROUP;
    else process.env.EXPO_PUBLIC_APP_GROUP = before;
  }
});

test('app group gate: the app reads the same app.json value, which an update carries with its JS', () => {
  const src = readFileSync(join(root, 'src/lib/lock-screen/index.tsx'), 'utf8');
  assert.match(src, /Constants\.expoConfig\?\.extra\?\.appGroup === true/);
  assert.doesNotMatch(src, /EXPO_PUBLIC_APP_GROUP/);
});

test('app group gate: the group leaves the entitlements, the rest stays', () => {
  const out = gate.withoutGroup({ [GROUPS]: ['group.com.ruinf.sweatbook'], 'com.apple.developer.associated-domains': ['applinks:sweatbook.poker'] });
  assert.equal(GROUPS in out, false);
  assert.deepEqual(out['com.apple.developer.associated-domains'], ['applinks:sweatbook.poker']);
  assert.deepEqual(gate.withoutGroup({ [GROUPS]: ['g'] }), {});
});

test('app group gate: 1C8F.1 leaves the app manifest, and the widget falls back to CA92.1', () => {
  const other: ApiType = { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] };
  const app = gate.withoutGroupReason({ NSPrivacyTracking: false, NSPrivacyAccessedAPITypes: [defaults(['CA92.1', '1C8F.1']), other] });
  assert.deepEqual(app.NSPrivacyAccessedAPITypes, [defaults(['CA92.1']), other]);
  assert.equal(app.NSPrivacyTracking, false);
  const widget = gate.withoutGroupReason({ NSPrivacyAccessedAPITypes: [defaults(['1C8F.1'])] });
  assert.deepEqual(widget.NSPrivacyAccessedAPITypes, [defaults(['CA92.1'])]);
  // Run twice (prebuild again): no change.
  assert.deepEqual(gate.withoutGroupReason(app), app);
});

test('app group gate: the EAS entry for the widget loses the group', () => {
  const config: Config = { extra: { eas: { build: { experimental: { ios: { appExtensions: [{ targetName: 'ExpoWidgetsTarget', entitlements: { [GROUPS]: ['group.com.ruinf.sweatbook'] } }] } } } } } };
  const ext = gate.withoutEasGroup(config).extra!.eas!.build!.experimental!.ios!.appExtensions![0];
  assert.deepEqual(ext.entitlements, {});
  assert.deepEqual(gate.withoutEasGroup({}), {});
});

test('app group gate: without the group the home widget leaves iOS only', () => {
  const plugins: Plugin[] = ['expo-router', ['expo-widgets', { enableAndroid: true, widgets: [{ name: 'SweatbookHome', ios: { supportedFamilies: ['systemSmall'] }, android: { minWidth: 2 } }] }]];
  const out = gate.withoutIosWidgets(plugins);
  assert.equal(out[0], 'expo-router');
  const [, props] = out[1] as [string, { widgets: { ios?: object | null; android?: object }[]; enableAndroid?: boolean }];
  assert.equal(props.widgets[0].ios, null);
  assert.deepEqual(props.widgets[0].android, { minWidth: 2 });
  assert.equal(props.enableAndroid, true);
  // The app.json entry itself is left as it was.
  assert.ok((plugins[1] as [string, { widgets: { ios?: object | null }[] }])[1].widgets[0].ios);
});
