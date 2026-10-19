// The widget and Live Activity target (ExpoWidgetsTarget, made by expo-widgets) reads the
// App Group's UserDefaults, and every target that uses a required-reason API needs its own
// privacy manifest, or App Store Connect warns (ITMS-91053). This one says only that: App
// Group UserDefaults (1C8F.1), no data collected, no tracking. Written with the Xcode project,
// after expo-widgets has made the target. Listed before expo-widgets in app.json: mods run last-listed first.
const { withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET = 'ExpoWidgetsTarget';
const FILE = 'PrivacyInfo.xcprivacy';

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>1C8F.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
`;

const withManifestInTarget = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targets = project.pbxNativeTargetSection();
    const targetUuid = Object.keys(targets).find((k) => !k.endsWith('_comment') && String(targets[k].name).replace(/"/g, '') === TARGET);
    if (!targetUuid) return config;
    const dir = path.join(config.modRequest.platformProjectRoot, TARGET);
    if (!fs.existsSync(dir)) return config;
    fs.writeFileSync(path.join(dir, FILE), MANIFEST);
    const groups = project.hash.project.objects.PBXGroup;
    const groupKey = Object.keys(groups).find((k) => !k.endsWith('_comment') && String(groups[k].name ?? groups[k].path ?? '').replace(/"/g, '') === TARGET);
    if (!groupKey) return config;
    const refs = project.pbxFileReferenceSection();
    if (Object.values(refs).some((r) => r && typeof r === 'object' && String(r.path).replace(/"/g, '') === FILE && groups[groupKey].children.some((c) => refs[c.value] === r))) return config;
    const target = targets[targetUuid];
    if (!target.buildPhases.some((p) => project.hash.project.objects.PBXResourcesBuildPhase?.[p.value])) project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    const phases = project.hash.project.objects.PBXResourcesBuildPhase;
    // By hand, as expo-widgets adds its own files: the xcode library's addResourceFile wants a "Resources" group.
    const fileRef = project.generateUuid();
    refs[fileRef] = { isa: 'PBXFileReference', lastKnownFileType: 'text.xml', name: `"${FILE}"`, path: `"${FILE}"`, sourceTree: '"<group>"' };
    refs[`${fileRef}_comment`] = FILE;
    groups[groupKey].children.push({ value: fileRef, comment: FILE });
    const buildFile = project.generateUuid();
    project.addToPbxBuildFileSection({ uuid: buildFile, fileRef, basename: FILE, group: 'Resources' });
    const phase = phases[target.buildPhases.find((p) => phases[p.value]).value];
    phase.files.push({ value: buildFile, comment: `${FILE} in Resources` });
    return config;
  });

module.exports = withManifestInTarget;
