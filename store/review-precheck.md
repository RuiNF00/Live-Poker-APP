# Pre-check before the first submission (PR #3, 2026-10-17)

Checked against `claude/live-poker-app-mvp-kdke3g` @ 22e4870. ✓ = OK in code, ⚠ = needs action (owner in brackets).

## Apple
- ✓ Paywall (3.1.2): price per period from the store, the trial ("Grátis durante 3 dias, depois …"; 3 days since Rui's decision on 17 Oct, `trialDays` in `src/billing/plans.ts` must read 3 before the review build), auto-renew + 24-hour cancellation text, Restore purchases, Terms and Privacy links, and a close button. `src/app/paywall.tsx`.
- ✓ Terms/EULA link in the description, privacy URL. The App Store Connect "License agreement" field can stay on Apple's standard EULA because our Terms link to it.
- ⚠ The subscriptions must be **submitted together with build 1.0** (with a paywall review screenshot each). Otherwise the reviewer sees "Ainda não disponível" and rejects under 2.1. [store thread, once the keys arrive]
- ✓ Deleting data in the app (5.1.1(v)): shared link → "Apagar partilha" (`hand/[id].tsx`); backup → Settings → Cloud backup → Turn off (DELETE `/api/backup`). No accounts, so no account-deletion requirement.
- ✓ (fixed in 0dfb5b5) When turning off the backup, `cloud-backup.ts:72` swallows the DELETE error (`.catch(() => {})`). Offline, the user thinks it was deleted but the server copy stays (it expires after 18 months). Show an error and keep the backup on. [main thread]
- ✓ (fixed in 0dfb5b5) Privacy manifest: `privacyManifests.NSPrivacyCollectedDataTypes` only lists OtherUserContent. Add PurchaseHistory, UserID, AudioData, ProductInteraction (Analytics) and DeviceID (Analytics + AppFunctionality), all not linked and not tracking, to match the App Store label. Also add `NSPrivacyAccessedAPITypes` explicitly (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1). Apple returns ITMS-91053 if a required-reason API has no declaration. [main thread]
- ⚠ Export compliance: the cloud backup encrypts in the app with AES-256-GCM (@noble/ciphers), not just HTTPS/OS. Under Apple's table ("industry standard algorithm, not provided within the Apple operating system") this needs the **French encryption declaration** to distribute in France; no CCATS needed (it isn't proprietary). Decision: `ITSAppUsesNonExemptEncryption` → **true** [main thread]; in App Store Connect answer "standard encryption algorithms" and **leave France out of v1 availability** until the declaration to ANSSI is accepted (step 30, optional, Rui). Source: developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption
- ✓ Microphone purpose string in PT and EN (`locales/*.json`); `supportsTablet: false`, so no iPad screenshots are needed.
- ✓ UGC (1.2): report on the page, deletion by the owner, hide after reports, moderation webhook.
- ✓ Age rating: answers in `privacy-forms.md` (no simulated gambling; UGC yes), override to 18+.
- ✓ Review notes updated in `review-risks.md` (the sample hand has no Share; explains how to test sharing, the paywall and the backup).

## Google Play
- ✓ targetSdkVersion/compileSdkVersion 36 (`expo-build-properties`); Expo SDK 58.
- ✓ No sensitive permissions (location/storage/SYSTEM_ALERT_WINDOW removed); microphone, camera, photos and Face ID are asked at runtime with PT/EN usage strings. Background modes: fetch and processing only (61cf15f removed a stray `audio`, which App Review rejects under 2.5.4 when the app plays no background audio).
- ✓ Data safety and deletion URL in `privacy-forms.md`; IARC as Utility, not a Game.
- ⚠ **Closed test with 12 testers for 14 days**: mandatory if Rui's Play account is **personal and created after 13 Nov 2023**. If so, the Android version **can't go public within 24h**: the minimum is 14 days of testing, and only then can he request production access (Google reviews that in about 7 days). iOS isn't affected. Steps in the checklist (`o-que-precisa-do-rui.md`, block 6).

## Festival planner (added at 2d301d9)
- The planner ships with a published festival schedule whose name includes a real event brand (`src/poker/festivals.ts`). Showing a public schedule inside the app is factual use, but App Review can ask for proof of rights under 5.2.1 if the brand looks like an endorsement. Keep the brand out of store metadata and screenshots (it is), and don't use its logo. If a reviewer objects, rename the entry to a generic label ("Bahamas festival, Dec 2026").

## Check at ac5dbc2
- Festival: shipped as "Bahamas, dezembro 2026" (#70); the venue field names the resort, which is a factual location, not an endorsement. Event titles in `src/poker/festivals.ts` are the published schedule's own names; none appear in store metadata or screenshots.
- Brand names left in-app only as input placeholders (`ContextSheet`, `SessionForm`, `staking/sheets`) and in the sample hand title (`src/poker/sample.ts`, "Estoril Poker Series"). Guideline 2.3.7 covers metadata, so these don't block, but the sample hand is visible to reviewers; a generic title ("Main Event €550") removes any doubt.
- Retention offer ids in `src/billing/plans.ts` match store/privacy-forms.md (`sweatbook_retention_40` / `sweatbook-retention-40`, −40% for 3 months, monthly plan, cancel flow only).
- Home widget (SweatbookHome) reads local data only: no privacy-form change. Listing now mentions it.

## Gambling-policy pass (Pesquisa thread, /mnt/project-files/research/politicas-lojas-jogo.md)
- Age rating answers unchanged (Apple: simulated gambling None, gambling No, contests None, UGC Yes, override 18+; Play: IARC non-game, no gambling, 18+). Never request Play's "Real-money gambling apps" declaration.
- Description now says "records and accounts only, no money moves through the app, 18+"; staking line reworded (no "sell/buy" offer language). Review notes carry the record-keeping paragraph.
- ~~Organizer links~~ fixed at e56594e (no wsop.com / worldpokertour.com urls left in src). Was: at 8eb59e3 the festival planner still opens organizer sites (`src/poker/festivals.ts` source urls: wsop.com and worldpokertour.com, both brands that run real-money gaming). Remove the outbound links or replace them with plain text before the build that goes to review. Still open at e56594e: "Vender ação" / "Sell action" in `src/components/StakeFields.tsx` and en.ts (Staking thread renaming it); recheck before the review build.
- Keywords stay clear of casino, bet, aposta, slots, "win money".

## Pending review-note change
- When Replayer #121 merges: replace the sharing instruction in review-risks.md with "Home → \"Ver uma mão de exemplo\" → \"Partilhar com amigos\" (the sample link does not count towards the free share limit)".

## Over-the-air updates (8147048, #146)
- expo-updates with EAS Update, `runtimeVersion` policy fingerprint, checked on launch. Allowed by Apple 3.3.1(b)/2.5.2 and Google Play's device-and-network-abuse policy only for JavaScript and asset fixes that don't change the app's purpose or add features that skip review: any new feature, price or Pro change goes through a store build. Rule for every thread: OTA only for fixes.
- No new data: EAS Update downloads the bundle from Expo's CDN and sends only the runtime version, platform and channel; nothing to add to the privacy label, the manifest or Data safety. The privacy policy's provider list doesn't need Expo, as no personal data is processed for the app.

## Android exact alarms (#170)
- `SCHEDULE_EXACT_ALARM` only, requested in context with an inexact fallback; never `USE_EXACT_ALARM` (Play limits it to alarm-clock/calendar apps with a declaration). Details in `privacy-forms.md`. Before the Play upload, check the merged manifest has no `USE_EXACT_ALARM` from a library.
