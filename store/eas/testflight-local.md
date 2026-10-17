# Internal TestFlight build

## Main path: cloud build (no Xcode or Mac needed)
EAS builds the app on its own servers. It can run from the cloud container or from any computer with Node:
```sh
npm i -g eas-cli
export EXPO_TOKEN=…                      # checklist step 12
export EXPO_ASC_API_KEY_PATH=…/AuthKey_XXXX.p8 EXPO_ASC_KEY_ID=… EXPO_ASC_ISSUER_ID=… EXPO_APPLE_TEAM_ID=…   # steps 15 and 17
git checkout claude/live-poker-app-mvp-kdke3g && npm ci
eas build --platform ios --profile testflight --non-interactive --auto-submit-with-profile testflight
```
- With the App Store Connect API key (role **Admin**), EAS creates the distribution certificate, the App Group `group.com.ruinf.sweatbook` and the provisioning profiles for the app and for the Live Activity extension `com.ruinf.sweatbook.ExpoWidgetsTarget` (PR #28) itself, with no Apple ID login. If it asks to sync capabilities or create the profile for the second target, answer yes. Without the key, run it once interactively (`eas build -p ios --profile testflight`) and sign in with the Apple ID when it asks.
- Free plan: the build waits in the queue (it can take some time) and the iOS build takes about 15-25 min. Then `--auto-submit` sends it to TestFlight.
- Prerequisite: the App Store Connect app record created with bundle `com.ruinf.sweatbook` (step 14).

Then App Store Connect → the app → TestFlight. Once the build is "Ready to Test", add Rui to an internal group and install it with the TestFlight app.

## Fallback: local build on the Mac (only if the cloud queue or credits get in the way)
Needs Xcode (App Store, opened once), `brew install cocoapods fastlane`, `eas login`.
```sh
eas build --platform ios --profile testflight --local --output sweatbook.ipa
eas submit --platform ios --profile testflight --path sweatbook.ipa
```

## Notes
- Export compliance: see `review-precheck.md` (the backup uses AES in the app, so the answer isn't "exempt").
- Without `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, the paywall shows "Ainda não disponível". That's expected until RevenueCat is set up. Then add the key to the `env` of the `testflight` profile (it's public).
- The build number goes up automatically (`autoIncrement`, `appVersionSource: remote`).
