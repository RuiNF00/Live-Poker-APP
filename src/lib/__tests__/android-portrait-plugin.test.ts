// The foldable opt-out lands once in <application>, next to whatever else is there.
import assert from 'node:assert/strict';
import { test } from 'node:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addPortraitProperty } = require('../../../plugins/with-android-portrait') as { addPortraitProperty: (m: Manifest) => Manifest };

type Prop = { $: Record<string, string> };
type Manifest = { manifest: { $: Record<string, string>; application?: { $: Record<string, string>; property?: Prop[] }[] } };

const NAME = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';
const base = (property?: Prop[]): Manifest => ({
  manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' }, ...(property ? { property } : null) }] },
});

test('android portrait: the property is added to the application, set to true', () => {
  const app = addPortraitProperty(base()).manifest.application![0];
  assert.deepEqual(app.property, [{ $: { 'android:name': NAME, 'android:value': 'true' } }]);
});

test('android portrait: running prebuild twice leaves one copy and keeps other properties', () => {
  const other = { $: { 'android:name': 'some.other', 'android:value': 'x' } };
  const once = addPortraitProperty(base([other]));
  const twice = addPortraitProperty(once).manifest.application![0].property!;
  assert.equal(twice.filter((p) => p.$['android:name'] === NAME).length, 1);
  assert.ok(twice.includes(other));
});
