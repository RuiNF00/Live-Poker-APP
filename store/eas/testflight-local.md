# Internal TestFlight build on Rui's Mac (no cloud build)

For the iPhone thread. Builds the app on the Mac and sends it to TestFlight; only Rui and the internal testers see it.

## Prerequisites (once)
- Xcode (App Store) opened once with the licence accepted; `xcode-select --install`.
- Node 22, `npm i -g eas-cli`, `brew install cocoapods fastlane`.
- `eas login` with Rui's Expo account (checklist step 11). Local builds also need it.
- Apple Developer Program active and the App Store Connect app record created with bundle `com.ruinf.sweatbook` (checklist step 14).

## Build and send
```sh
git checkout claude/live-poker-app-mvp-kdke3g && npm ci
eas build --platform ios --profile testflight --local --output sweatbook.ipa
#   the first time it asks for the Apple ID: answer yes to "generate a new Distribution Certificate / Provisioning Profile"
eas submit --platform ios --profile testflight --path sweatbook.ipa
#   asks for the Apple ID (or uses the ASC API key from step 15) and picks the app record
```
Then App Store Connect → the app → TestFlight. Once the build is "Ready to Test" (about 10-20 min of processing), add Rui to an internal group. Install it with the TestFlight app on the iPhone.

## Notes
- `ITSAppUsesNonExemptEncryption=false` is already in app.json, so TestFlight doesn't ask about encryption.
- Without `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, the paywall shows "Ainda não disponível". That's expected until RevenueCat is set up. When it is, add the key to the `env` of the `testflight` profile (it's public, so it can live in eas.json).
- The build number goes up automatically (`autoIncrement` with `appVersionSource: remote`).
