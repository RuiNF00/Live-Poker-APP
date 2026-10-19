// The widget and Live Activity extension (ExpoWidgetsTarget, from expo-widgets) reads the App
// Group's UserDefaults, which Apple counts as a required-reason API: without its own privacy
// manifest the upload gets ITMS-91053. This adds one to the extension: UserDefaults 1C8F.1
// (shared within the App Group), no tracking, nothing collected. The app's own manifest is in
// app.json (ios.privacyManifests), where 1C8F.1 sits next to CA92.1.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

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

function withWidgetPrivacyFile(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, TARGET);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, FILE), MANIFEST);
      return c;
    },
  ]);
}

function withWidgetPrivacyResource(config) {
  return withXcodeProject(config, (c) => {
    const project = c.modResults;
    const target = project.pbxTargetByName(TARGET);
    const targetUuid = target && project.findTargetKey(TARGET);
    const groupKey = project.findPBXGroupKey({ name: TARGET });
    if (!targetUuid || !groupKey) {
      throw new Error(`with-widget-privacy: no ${TARGET} target. Keep this plugin right before expo-widgets in app.json (a mod registered earlier runs later).`);
    }
    // Already there (a second prebuild without --clean).
    if (project.getPBXGroupByKey(groupKey).children.some((ch) => ch.comment === FILE)) return c;
    const refs = project.pbxFileReferenceSection();
    const fileRef = project.generateUuid();
    refs[fileRef] = { isa: 'PBXFileReference', lastKnownFileType: 'text.xml', path: FILE, sourceTree: '"<group>"' };
    refs[`${fileRef}_comment`] = FILE;
    project.addToPbxGroup({ fileRef, basename: FILE }, groupKey);

    const objects = project.hash.project.objects;
    let phase = (target.buildPhases || []).map((p) => objects.PBXResourcesBuildPhase?.[p.value]).find(Boolean);
    if (!phase) {
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
      phase = (project.pbxNativeTargetSection()[targetUuid].buildPhases || []).map((p) => objects.PBXResourcesBuildPhase?.[p.value]).find(Boolean);
    }
    const buildFile = project.generateUuid();
    project.addToPbxBuildFileSection({ uuid: buildFile, fileRef, basename: FILE, group: 'Resources' });
    phase.files.push({ value: buildFile, comment: `${FILE} in Resources` });
    return c;
  });
}

module.exports = function withWidgetPrivacy(config) {
  return withWidgetPrivacyResource(withWidgetPrivacyFile(config));
};
