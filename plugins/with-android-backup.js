// Android Auto Backup: carry the hands, sessions and settings to a new phone or
// a reinstall. AsyncStorage keeps everything in the RKStorage database, which the
// expo-secure-store rules leave out, so a reinstall restored nothing. Keychain
// values (app lock, PIN fails) stay out: their keys don't survive a restore.
// Files stay out too: voice notes and receipts could pass Google's 25 MB cap.
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore.xml"/>
    <include domain="database" path="RKStorage"/>
    <include domain="database" path="RKStorage-journal"/>
    <include domain="database" path="RKStorage-wal"/>
    <include domain="database" path="RKStorage-shm"/>`;

const FULL = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>${RULES}
</full-backup-content>
`;

const EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>${RULES}
  </cloud-backup>
  <device-transfer>${RULES}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withAndroidBackup(config) {
  config = withDangerousMod(config, [
    'android',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'sweatbook_backup_rules.xml'), FULL);
      fs.writeFileSync(path.join(dir, 'sweatbook_data_extraction_rules.xml'), EXTRACTION);
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$['android:allowBackup'] = 'true';
    app.$['android:fullBackupContent'] = '@xml/sweatbook_backup_rules';
    app.$['android:dataExtractionRules'] = '@xml/sweatbook_data_extraction_rules';
    return c;
  });
};
