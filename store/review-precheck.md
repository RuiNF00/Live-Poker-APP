# Pre-check before the first submission (PR #3, 2026-10-17)

Checked against `claude/live-poker-app-mvp-kdke3g` @ 22e4870. ✓ = OK in code, ⚠ = needs action (owner in brackets).

## Apple
- ✓ Paywall (3.1.2): price per period from the store, the trial ("Grátis durante 7 dias, depois …"), auto-renew + 24-hour cancellation text, Restore purchases, Terms and Privacy links, and a close button. `src/app/paywall.tsx`.
- ✓ Terms/EULA link in the description, privacy URL. The App Store Connect "License agreement" field can stay on Apple's standard EULA because our Terms link to it.
- ⚠ The subscriptions must be **submitted together with build 1.0** (with a paywall review screenshot each). Otherwise the reviewer sees "Ainda não disponível" and rejects under 2.1. [store thread, once the keys arrive]
- ✓ Deleting data in the app (5.1.1(v)): shared link → "Apagar partilha" (`hand/[id].tsx`); backup → Settings → Cloud backup → Turn off (DELETE `/api/backup`). No accounts, so no account-deletion requirement.
- ⚠ When turning off the backup, `cloud-backup.ts:72` swallows the DELETE error (`.catch(() => {})`). Offline, the user thinks it was deleted but the server copy stays (it expires after 18 months). Show an error and keep the backup on. [main thread]
- ⚠ Privacy manifest: `privacyManifests.NSPrivacyCollectedDataTypes` only lists OtherUserContent. Add PurchaseHistory, UserID, AudioData, ProductInteraction (Analytics) and DeviceID (Analytics + AppFunctionality), all not linked and not tracking, to match the App Store label. Also add `NSPrivacyAccessedAPITypes` explicitly (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1). Apple returns ITMS-91053 if a required-reason API has no declaration. [main thread]
- ✓ Microphone purpose string in PT and EN (`locales/*.json`); export compliance false; `supportsTablet: false`, so no iPad screenshots are needed.
- ✓ UGC (1.2): report on the page, deletion by the owner, hide after reports, moderation webhook.
- ✓ Age rating: answers in `privacy-forms.md` (no simulated gambling; UGC yes), override to 18+.
- ✓ Review notes updated in `review-risks.md` (the sample hand has no Share; explains how to test sharing, the paywall and the backup).

## Google Play
- ✓ targetSdkVersion/compileSdkVersion 36 (`expo-build-properties`); Expo SDK 58.
- ✓ No sensitive permissions (location/storage blocked); the microphone only comes from expo-audio, at runtime.
- ✓ Data safety and deletion URL in `privacy-forms.md`; IARC as Utility, not a Game.
- ⚠ **Closed test with 12 testers for 14 days**: mandatory if Rui's Play account is **personal and created after 13 Nov 2023**. If so, the Android version **can't go public within 24h**: the minimum is 14 days of testing, and only then can he request production access (Google reviews that in about 7 days). iOS isn't affected. Steps in the checklist (`o-que-precisa-do-rui.md`, block 6).
