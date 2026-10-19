// Without EXPO_PUBLIC_APP_GROUP=1 an iOS build carries no App Group anywhere: entitlements,
// privacy manifests and the EAS credentials entry.
import assert from 'node:assert/strict';
import { test } from 'node:test';

type Ent = Record<string, unknown>;
type ApiType = { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] };
type Manifest = { NSPrivacyTracking?: boolean; NSPrivacyAccessedAPITypes?: ApiType[] };
type Config = { extra?: { eas?: { build?: { experimental?: { ios?: { appExtensions?: { targetName: string; entitlements?: Ent }[] } } } } } };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gate = require('../../../plugins/with-app-group-gate') as {
  appGroupOn: (env: Record<string, string | undefined>) => boolean;
  withoutGroup: (e: Ent) => Ent;
  withoutGroupReason: (m: Manifest) => Manifest;
  withoutEasGroup: (c: Config) => Config;
};

const GROUPS = 'com.apple.security.application-groups';
const defaults = (reasons: string[]): ApiType => ({ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: reasons });

test('app group gate: on only with EXPO_PUBLIC_APP_GROUP=1', () => {
  assert.equal(gate.appGroupOn({}), false);
  assert.equal(gate.appGroupOn({ EXPO_PUBLIC_APP_GROUP: '0' }), false);
  assert.equal(gate.appGroupOn({ EXPO_PUBLIC_APP_GROUP: 'true' }), false);
  assert.equal(gate.appGroupOn({ EXPO_PUBLIC_APP_GROUP: '1' }), true);
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
