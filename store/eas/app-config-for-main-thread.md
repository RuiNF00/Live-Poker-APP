# app.json fields the release needs

For the thread that owns the app code. Merge these into `app.json` (`expo` key); nothing here changes app behaviour.

```json
{
  "expo": {
    "name": "{{APP_NAME}}",
    "slug": "sweatbook",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "{{IOS_BUNDLE_ID}}",
      "supportsTablet": false,
      "usesAppleSignIn": true,
      "associatedDomains": ["applinks:{{WEB_DOMAIN}}"],
      "config": { "usesNonExemptEncryption": false },
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      },
      "privacyManifests": {
        "NSPrivacyTracking": false,
        "NSPrivacyTrackingDomains": [],
        "NSPrivacyCollectedDataTypes": [
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
          { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCrashData", "NSPrivacyCollectedDataTypeLinked": false, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] }
        ]
      }
    },
    "android": {
      "package": "{{ANDROID_PACKAGE}}",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#0F1113" },
      "permissions": [],
      "blockedPermissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW"
      ],
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "{{WEB_DOMAIN}}", "pathPrefix": "/h/" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": [
      ["expo-build-properties", { "android": { "targetSdkVersion": 36, "compileSdkVersion": 36 } }]
    ],
    "extra": { "eas": { "projectId": "EAS_PROJECT_ID" } }
  }
}
```

## Why each one matters

- `supportsTablet: false`: avoids Apple requiring iPad screenshots and iPad layout review. Turn on later.
- `ITSAppUsesNonExemptEncryption: false`: skips the export compliance question on every upload (HTTPS only is exempt).
- `privacyManifests`: Apple rejects uploads whose SDKs use required-reason APIs without a manifest. Keep the collected types in sync with `store/privacy-forms.md`.
- `usesAppleSignIn`: required by guideline 4.8 if the app offers Google sign-in. Drop it if login is email-only.
- `associatedDomains` / `intentFilters`: share links `https://{{WEB_DOMAIN}}/h/<id>` open the app when installed. The web side must serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.
- `blockedPermissions`: some Expo libraries add these by default; any of them triggers extra Play Console declarations and review questions.
- `targetSdkVersion: 36`: Google Play requires API 36 for new apps since 31 August 2026. Expo SDK 54+ defaults to it; the plugin line just pins it.
- In-app account deletion (Settings → Delete account) is mandatory on both stores if the app has accounts.
