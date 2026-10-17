# Internal TestFlight build

## Main path: cloud build (no Xcode or Mac needed)
EAS builds the app on its own servers. It can run from the cloud container or from any computer with Node:
```sh
npm i -g eas-cli
export EXPO_TOKEN=…                      # checklist step 12
export EXPO_ASC_API_KEY_PATH=…/AuthKey_XXXX.p8 EXPO_ASC_KEY_ID=… EXPO_ASC_ISSUER_ID=… EXPO_APPLE_TEAM_ID=…   # steps 15 and 17
git checkout claude/live-poker-app-mvp-kdke3g && npm ci
npm run check:release && eas build --platform ios --profile testflight --non-interactive --auto-submit-with-profile testflight
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
- Since #106 the `production` and `testflight` builds **fail** in `eas-build-pre-install` unless `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`) and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) exist as EAS environment variables in the **production** environment. After creating the RevenueCat apps (store thread, with the step 24 key), run with EXPO_TOKEN set: `eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_… --visibility plaintext --non-interactive` and the same for the Android key. Both keys are public SDK keys. On a real build, if offerings fail to load, the paywall shows a retry message, not fallback prices (App Review 2.1).
- Native modules need a new build, not an OTA update: the on-device text reader for the buy-in receipt and structure-sheet photos (#152) only works from the first TestFlight build that includes it; Expo Go shows "Disponível na versão da loja". Any later PR that adds a native module also needs a new TestFlight build before testers can try it.
- The build number goes up automatically (`autoIncrement`, `appVersionSource: remote`).

- Always run `npm run check:release` (scripts/pre-release.mjs: migration tests with old and corrupted data, types, lint, all tests, hand-format package, Expo config, bundle export; ~65 s, `--quick` skips the export) right before any store build. It stops at the first failure.
- Both store profiles set `"environment": "production"` in eas.json, so the RevenueCat keys in the EAS production environment reach the testflight build too.

## Beta builds vs store builds (EXPO_PUBLIC_BUILD_CHANNEL)
- `testflight` and `play-test` builds set `EXPO_PUBLIC_BUILD_CHANNEL` (#145), so every event from a beta tester carries `channel: testflight` / `play-test` and can be left out of launch numbers (`launch/metricas-lancamento.md` §3).
- The value is baked into the binary. So the build sent to App Review and to Play production is a fresh **`production`** build (no channel set), not the beta build: `eas build -p ios --profile production --auto-submit` and `eas build -p android --profile production --auto-submit`. Same code as the last beta build, new build number; QA smoke-tests it before release.
- Play closed test: `eas build -p android --profile play-test --auto-submit-with-profile play-test` uploads to the closed track (`alpha`). The very first Android upload is still by hand (Rui, step 26).
