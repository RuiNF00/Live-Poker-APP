#!/usr/bin/env node
// What the iOS build's Info.plist will hold, read from the Expo config with its
// plugins applied (no ios/ folder is written). App Review rejects a background
// mode the app doesn't use and a permission prompt without its explanation.

import { execSync } from 'node:child_process';

const BACKGROUND = ['fetch', 'processing'];
const USAGE = ['NSCameraUsageDescription', 'NSFaceIDUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription'];

const config = JSON.parse(execSync('npx expo config --type introspect --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }));
const plist = config.ios?.infoPlist ?? {};
const problems = [];

const modes = [...(plist.UIBackgroundModes ?? [])].sort();
if (JSON.stringify(modes) !== JSON.stringify(BACKGROUND)) problems.push(`UIBackgroundModes is ${JSON.stringify(modes)}, expected exactly ${JSON.stringify(BACKGROUND)}`);
for (const k of USAGE) if (typeof plist[k] !== 'string' || !plist[k].trim()) problems.push(`${k} is missing or empty`);
const extra = Object.keys(plist).filter((k) => /UsageDescription$/.test(k) && !USAGE.includes(k));
if (extra.length) problems.push(`unexpected permission texts (a plugin asks for more?): ${extra.join(', ')}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`UIBackgroundModes ${JSON.stringify(modes)}; ${USAGE.length} permission texts present.`);
