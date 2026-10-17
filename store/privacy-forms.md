# Store forms: ready answers

Based on v1 as built (confirmed by the app thread, 2026-10-17): **no accounts, no sign-in, no third-party analytics or ads SDKs** (crash reports via Sentry, #166, declared below), all hand data local on the device unless the user turns on the optional cloud backup (recovery code, no account; deleted after 18 months without updates). Only a hand the user chooses to share (public link) and anonymous comments/votes on it reach our backend (Supabase). Subscriptions via Apple/Google in-app purchase through RevenueCat (products sweatbook_pro_monthly 29.99 USD, sweatbook_pro_annual 199.99 USD, 3-day free intro offer on the annual plan only (Rui, 17 Oct 15:04; was 1 week), group "Sweatbook Pro"). The app sends first-party usage events (event name, random per-install ID, platform; no personal data) to `https://{{WEB_DOMAIN}}/api/events`. If any of this changes (crash reporter, analytics, RevenueCat, accounts), update this file and the privacy policy together.

## Apple: App Privacy ("nutrition label")

Data used to track you: **None**.

Data linked to you (over-declared on purpose, per the data audit `/mnt/project-files/launch/auditoria-dados-privacidade.md` #10):

| Category → type | Purpose |
|---|---|
| Contact Info → Name (a nickname the user types for comments, the backer page, a public profile, swaps or coaching links; optional; it sits next to that player's data on a page, so we declare it linked) | App Functionality |

Data not linked to you:

| Category → type | Purpose |
|---|---|
| User Content → Other User Content (shared hands, comments, optional cloud backup of hands and notes, optional live session page for backers, optional public player profile with display name, bio and picked session cards, optional swaps between two players, optional private coaching links with coach comments, optional action-package agreements sent to a backer) | App Functionality |
| User Content → Other User Content (optional cancellation feedback: reason + up to 120 characters) | Analytics |
| Purchases → Purchase History (RevenueCat receives receipts) | App Functionality |
| Identifiers → User ID (RevenueCat anonymous app user ID, random, not tied to identity) | App Functionality |
| Financial Info → Other Financial Info (amounts the user chooses to publish: live session page result and stack, swap prizes and payments, public profile buy-ins/results when "Hide amounts" is off, action-package costs; optional) | App Functionality |
| Audio Data (voice notes for Instagram story videos, processed on our server and not retained) | App Functionality |
| User Content → Photos or Videos (iPhone only: front-camera clip for the hand video, #234, sent to our server only to put the face in a circle on the MP4, then deleted; never stored, no facial recognition) | App Functionality |
| Usage Data → Product Interaction (first-party usage events: event name, random install ID, platform, app version, channel; also used to check an invited friend's first hand for the referral reward) | Analytics, App Functionality |
| Identifiers → Device ID (random per-install ID for those events and for invites; not the IDFA) | Analytics, App Functionality |
| Diagnostics → Crash Data (Sentry, EU region, #166: crash stack, app/update version, device model and OS; no IP, user id, device name or device id, scrubbed in the app and by server rules; automatic sessions off, so no Performance Data; only in builds with a DSN and while the Settings switch is on) | App Functionality |
| Usage Data → Advertising Data (iOS: the Apple Ads attribution token, collected by RevenueCat with `enableAdServicesAttributionTokenCollection` in `src/billing/purchases.ts`, which tells us which Apple Ads campaign and keyword led to a trial or purchase; plus the first-touch install source sent with our usage events: a source label such as invite or shared hand and a short campaign tag from our own links, `src/lib/attribution.ts`. No IDFA, no ATT prompt, no ad SDK) | Analytics |

Advertising Data (Security decision, scorecard #9): declared, **not linked, not used for tracking, Analytics**, matching the manifest at ae923f4. No ATT prompt is needed: the AdServices token is not tracking and holds no IDFA. The Apple Ads campaign and keyword stay in RevenueCat and never go into our usage events or PostHog with the install ID. Play: no change (iOS only).

Not declared: the server keeps a daily-rotating keyed hash of the IP (max 30 days) only to rate-limit reports, votes and shares; it cannot be reversed or linked to a user, so it is not collected personal data for either form.

Voice notes on hands (PR #25) stay on the device and are not declared; only Instagram story voice notes are (Audio, processed ephemerally).

PostHog EU (#106, optional): our server forwards usage events (install id, event name, small props; no IP, no free text) to PostHog as our processor. Still Analytics / not linked / not tracking on Apple; on Play, transfers to a service provider acting on our behalf are not "sharing", so "Shared: No" stays.

Exchange rates (Bankroll home-currency PR): the app fetches ECB daily rates from api.frankfurter.app (no key, no user data, cached on device). Nothing about the user is sent, so it adds no row to either form; the third-party request is disclosed in the privacy policy. If the app ever proxies this through our server or adds an identifier, revisit.

App lock (Face ID / passcode, #81) and tax details with receipt photos (#85) stay on the device. Receipt and tax-form photos and files never leave the phone: they are files in the app's documents folder (`src/lib/docs.native.ts`), and the cloud backup serialises only the session data with the file names (`src/lib/cloud-backup.ts`, checked at 24efbeb). So receipt photos add no rows. (Photos or Videos is declared on Apple only for the face clip in hand videos, #234, iOS only; Play stays without it.) Swaps (#90) store both nicknames, prizes and payments: covered by Other User Content and Name.

Notes for the form: data the user keeps only on device is not "collected" for Apple's purposes, so local hands and player notes are not declared.

Privacy Policy URL: `https://{{WEB_DOMAIN}}/privacy`

## Apple: Age rating questionnaire (2025+ format)

- Simulated gambling: **None** (no poker is played in the app; it records hands played elsewhere).
- Gambling / contests, real-money gambling: **No**.
- Mature themes, violence, profanity, medical, alcohol/tobacco/drugs: **None**.
- User-generated content: **Yes** (shared hands and comments). Requires report + removal, see `review-risks.md`.
- Messaging / chat: No. Unrestricted web access: No.
- Then set the **age override to 18+**: the app is about casino poker and the terms require 18+. Over-rating never causes a rejection; under-rating a poker app sometimes draws a question.

## Apple: other App Store Connect fields

- Content rights: no third-party content.
- Export compliance: `ITSAppUsesNonExemptEncryption=true` (confirmed in the prebuild at cd6635d). Answer "uses standard encryption algorithms" (AES-256-GCM in the app for the cloud backup), no proprietary encryption, no CCATS; France excluded from v1 until the ANSSI declaration (see review-precheck.md and availability.md).
- Sign-in required: No. No demo account needed. Review notes in `review-risks.md`.
- Retention offer ("Conversão para Pro" thread), created by the store thread with the API keys, not by Rui: Apple promotional offer `sweatbook_retention_40` on sweatbook_pro_monthly (-40% for 3 months, pay as you go); Play offer `sweatbook-retention-40` on the monthly base plan (-40% for 3 months, developer-determined eligibility); Play base plan pause enabled (up to 3 months). Without them the app hides the offer.
- Annual free trial: **3 days** (Rui, 17 Oct). App Store Connect → Subscriptions → `sweatbook_pro_annual` → Introductory Offers → Free, duration 3 days, all countries, new subscribers only. Play Console → `sweatbook_pro_annual` → base plan → Add offer → Free trial P3D, eligibility "New customer acquisition: never had this subscription". Both created by the store thread with the API keys; the paywall must show the price and first charge date, which the Conversão thread is handling.
- Retention offer and pause: App Store promotional offer `sweatbook_retention_40` on `sweatbook_pro_monthly` (40% off for 3 months; needs the In-App Purchase key from step 16 loaded into RevenueCat), Play offer `sweatbook-retention-40` on the monthly base plan, and **pause turned on** in both Play base plans (the cancel screen offers a 3-month pause on Android). All created by the store thread through the APIs.
- Every product gets an App Review screenshot (the paywall for the subscriptions, the cancel screen for lifetime and the retention offer), rendered from the app like the store screenshots, and is submitted with version 1.0.
- Lifetime purchase (merged in #106): non-consumable `sweatbook_lifetime`, 499 USD (or the nearest Apple price point) / 499 USD Play one-time product, unlocks the same RevenueCat entitlement as the subscription, shown only in the cancel flow. Created by the store thread with the API keys (App Store Connect, Play Console, RevenueCat) and submitted with the version like the subscriptions. Restore purchases must restore it.
- RevenueCat setup the app depends on (Conversão, 17 Oct; created by the store thread with the secret key from step 24): entitlement id exactly `pro` (the app and the web's `REVENUECAT_ENTITLEMENT` read it), attached to all three products. One offering marked **Current** (`default`) with three packages: Monthly `$rc_monthly` → `sweatbook_pro_monthly`, Annual `$rc_annual` → `sweatbook_pro_annual`, Lifetime `$rc_lifetime` → `sweatbook_lifetime`. Offering metadata empty at launch (`{"lifetime": false}` hides lifetime without a release; `layout`/`copy` only for A/B tests). Retention ids exactly as above (Play matches the offer tag or the `:sweatbook-retention-40` suffix; iOS needs the In-App Purchase .p8 in RevenueCat). **Pre-submit check:** all three packages attached to the Current offering, or the paywall shows no trial.
- In-App Purchases: create the subscription products in App Store Connect before submitting, attach them to the version, and give each a review screenshot of the paywall. Requires the Paid Apps agreement, bank and tax forms done by Rui.
- EU Digital Services Act trader status: question for Rui. A paid subscription makes the app commercial, which in practice means **trader** (his address and phone shown on the EU listing) unless he publishes through a company.

## Apple: Accessibility Nutrition Labels

Declare only what was tested on an iPhone (source: `/mnt/project-files/design/auditoria-acessibilidade.md` §9). At 174ec64 that was **Dark Interface** only (the app is dark-only). By fbdc87f the code also has VoiceOver for hand entry (#151), text up to 200% and contrast fixes (#144) and Reduce Motion in the replayer (#121); declare VoiceOver, Larger Text, Sufficient Contrast and Reduced Motion only after QA's `launch/roteiro-acessibilidade-beta.md` passes on an iPhone. VoiceOver, Larger Text, Sufficient Contrast, Differentiate Without Color and Reduced Motion stay undeclared until the audit's fixes (§1-4, §6, §7) are merged and pass its 10-minute test (§8). The labels are optional and can be added after launch; a false label is grounds for complaints and rejection.

## Google Play: Data safety

- Does the app collect or share user data? **Yes, collects**. Shared with third parties: **No**.
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, `https://{{WEB_DOMAIN}}/delete-account` (Google asks for this URL whenever data is collected, even without accounts).

| Data type | Collected | Optional | Purpose |
|---|---|---|---|
| App activity → Other user-generated content (shared hands, comments, optional cloud backup, optional live session page for backers, optional public profile bio and session cards, optional swaps, optional coaching links and comments, optional action-package agreements, optional cancellation feedback) | Yes | Yes (only when the user shares, comments, turns on backup, shares a session, makes a profile or types feedback) | App functionality, Analytics (feedback only) |
| Financial info → Other financial info (amounts the user publishes on a live page, swap, public profile or action package; optional) | Yes | Yes | App functionality |
| Personal info → Name (a nickname the user types: comment name, backer page nickname, profile display name and handle, coaching link names) | Yes | Yes | App functionality |
| Financial info → Purchase history | Yes (RevenueCat) | Yes (only subscribers) | App functionality |
| Device or other IDs | Yes (RevenueCat random app user ID; random install ID for usage events and invites) | No | App functionality, Analytics |
| Audio → Voice or sound recordings | Yes (voice notes for story videos) | Yes | App functionality, **processed ephemerally: Yes** |
| App activity → App interactions (first-party usage events; also the referral check) | Yes | No | Analytics, App functionality |
| App info and performance → Crash logs (Sentry, #166; switch in Settings → Os teus dados) | Yes | Yes (optional) | App functionality |

Install source (`src/lib/attribution.ts`: source label + campaign tag from our own links, sent with usage events) has no own Play category; it is covered by App interactions above. The Apple Ads token is iOS only, so nothing changes on Play. Apple gets its own Advertising Data row to match the privacy manifest (added at ae923f4).

Processed ephemerally: No, except audio (Yes).

## Google Play: App content declarations

- Privacy policy: `https://{{WEB_DOMAIN}}/privacy`
- Ads: **No**: the app shows no ads.
- App access: all functionality available without special access (paid features: give the reviewer a note that a test subscription can be bought with Play's license testers).
- Target audience: **18 and over only**.
- Content rating (IARC): category "Utility, Productivity, Communication, or Other" (not Game). No real or simulated gambling. Users can interact / share content: **Yes**. Digital purchases: **Yes**.
- Financial features: **None**. News: No. Health: No. Government: No.
- Real-money gambling, games and contests: **No**.
- Account deletion: not applicable (no accounts). If Play still shows the question, answer "My app does not allow users to create an account".

## Permissions as built (prebuild at cd6635d)
- iOS usage strings: Camera, Photo Library, Face ID, Microphone (PT and EN). UIBackgroundModes: fetch, processing only (stray `audio` removed at 61cf15f).
- Android: INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, USE_BIOMETRIC / USE_FINGERPRINT, VIBRATE (plus POST_NOTIFICATIONS from expo-notifications if the merged manifest keeps it). No location, no storage, no SYSTEM_ALERT_WINDOW. The Data safety rows above match: no location, contacts or files declared; audio only for story voice notes; photos only inside the encrypted backup.

## Android exact alarms (#170, tournament level timers)
- Use **`SCHEDULE_EXACT_ALARM`**, not `USE_EXACT_ALARM`. Google Play's policy limits `USE_EXACT_ALARM` to apps whose core function is an alarm clock, timer or calendar, behind a Permissions declaration in the Play Console; a poker tracker would be rejected. `SCHEDULE_EXACT_ALARM` needs no Play declaration.
- On Android 14+ `SCHEDULE_EXACT_ALARM` is **denied by default** for new installs (Android docs, "Schedule exact alarms are denied by default"). The app must check `canScheduleExactAlarms()`, ask only when the player turns on level alerts (open `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` with a one-line reason), and fall back to `setWindow`/inexact notifications if the player says no. Without that check, `setExact*` throws.
- Data safety and the privacy policy don't change: the alarm is local and nothing leaves the phone.

## Face clip in the hand video (#234, Security OK 17:10)

Applied with #234. Apple row is in the table above; the policy row is in all 4 languages.
- Apple: add **User Content → Photos or Videos** (front-camera clip for the hand video, sent to our server only to place the face on the MP4, then deleted; never stored) → App Functionality, not linked, no tracking. Audio Data already covers the clip's sound (App Functionality).
- Play: **no change** while the face clip is iOS only (`canRecordFace` requires Platform.OS === 'ios'; Security 16:53). If it comes to Android: Photos and videos → Videos, optional, App functionality, processed ephemerally: Yes.
- Manifest (main): `NSPrivacyCollectedDataTypePhotosorVideos`, linked false, tracking false, AppFunctionality.
- Camera purpose string (in PR #234 at 6c80702: app.json expo-image-picker `cameraPermission` = pt-PT, plus `locales/*.json` NSCameraUsageDescription). The current text is kept and the face part is added: pt-PT "O Sweatbook usa a câmara para fotografares recibos e formulários de impostos (W-2G, 1042-S) e para gravares a tua cara nos vídeos das mãos."; EN "Sweatbook uses the camera so you can photograph tax receipts and forms (W-2G, 1042-S) for your sessions and record your face for hand videos."; pt-BR "O Sweatbook usa a câmera para você fotografar recibos e formulários de impostos (W-2G, 1042-S) e gravar seu rosto nos vídeos das mãos."; es "Sweatbook usa la cámara para que fotografíes recibos y formularios de impuestos (W-2G, 1042-S) de tus sesiones y grabes tu cara en los vídeos de las manos."
- Microphone purpose string (same PR; the face clip records sound): expo-audio `microphonePermission` + locales NSMicrophoneUsageDescription gain the hand videos: pt-PT "O Sweatbook usa o microfone para gravares notas de voz sobre as tuas mãos e para as histórias e os vídeos das mãos."; EN "Sweatbook uses the microphone to record voice notes about your hands and for your stories and hand videos."; pt-BR "O Sweatbook usa o microfone para você gravar notas de voz sobre suas mãos e para os stories e os vídeos das mãos."; es "Sweatbook usa el micrófono para que grabes notas de voz sobre tus manos y para tus historias y vídeos de manos."
- Policy row (4 languages), next to the story voice note: "Face clip for hand videos (Pro, only when you tap «Gravar com a cara»): a short front-camera video with sound, sent to our server only to put your face in a circle on the video, then deleted. Not stored, not linked to you, and we do no facial recognition." Note in each language that it is iPhone only. Also drop "and photos never do" from the "what reaches us" sentence, or change it to "receipt photos never do".

## Pending: comment push token (#247, waiting for Security)

Apply only after Security's OK on #247, then send main the PR together with this commit (same rule as the face clip). What #247 stores (`supabase/migrations/20261017310000_comment_push.sql`): the Expo push token, the language and the time zone, one row per shared hand, only after the player allows notifications. It is deleted with the link (`on delete cascade`, so "Apagar partilha" and "Apagar tudo" remove it) or when notifications are turned off for that hand. Only the web server reads it. The notice carries only the street, with no name, amount or venue. It is sent through the Expo push service, which forwards it to Apple (APNs) or Google (FCM).
- Apple label: add **Identifiers → Device ID**: not linked to the user, no tracking, purpose App Functionality. Keep the time zone out of the label: it only holds a notice until quiet hours end and isn't location (Apple's "coarse location" means a position of about 1 km or more).
- Play Data safety: add **Device or other IDs**: collected, not shared (Expo, Apple and Google act as service providers), ephemeral no, optional (the user chooses notifications), purpose App functionality.
- Policy (store/web/privacy.html, all 4 languages): a row "Comment notifications: if you turn on notifications for a shared hand, we keep your device's push token, language and time zone with that link so we can tell you about new comments. Deleted with the link or when you turn them off. Sent through Expo's push service to Apple or Google". Add Expo (650 Industries, Inc.) to the providers.
