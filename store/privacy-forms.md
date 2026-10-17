# Store forms: ready answers

Based on v1 as built (confirmed by the app thread, 2026-10-17): **no accounts, no sign-in, no third-party analytics/ads/crash SDKs**, all hand data local on the device unless the user turns on the optional cloud backup (recovery code, no account; deleted after 18 months without updates). Only a hand the user chooses to share (public link) and anonymous comments/votes on it reach our backend (Supabase). Subscriptions via Apple/Google in-app purchase through RevenueCat (products sweatbook_pro_monthly 29.99 USD, sweatbook_pro_annual 199.99 USD, 3-day free intro offer on the annual plan only (Rui, 17 Oct 15:04; was 1 week), group "Sweatbook Pro"). The app sends first-party usage events (event name, random per-install ID, platform; no personal data) to `https://{{WEB_DOMAIN}}/api/events`. If any of this changes (crash reporter, analytics, RevenueCat, accounts), update this file and the privacy policy together.

## Apple: App Privacy ("nutrition label")

Data used to track you: **None**. Data linked to you: **None**.

Data not linked to you:

| Category → type | Purpose |
|---|---|
| User Content → Other User Content (shared hands, comments, optional cloud backup of hands and notes, optional live session page for backers, optional public player profile with display name, bio and picked session cards, optional swaps between two players, optional private coaching links with coach comments, optional action-package agreements sent to a backer) | App Functionality |
| User Content → Other User Content (optional cancellation feedback: reason + up to 120 characters) | Analytics |
| Purchases → Purchase History (RevenueCat receives receipts) | App Functionality |
| Identifiers → User ID (RevenueCat anonymous app user ID, random, not tied to identity) | App Functionality |
| Financial Info → Other Financial Info (amounts the user chooses to publish: live session page result and stack, swap prizes and payments, public profile buy-ins/results when "Hide amounts" is off, action-package costs; optional) | App Functionality |
| User Content → Photos or Videos (receipt and tax-form photos, only inside the optional end-to-end encrypted cloud backup) | App Functionality |
| Contact Info → Name (a nickname the user types for comments, the backer page or a public profile; optional, not tied to identity) | App Functionality |
| Audio Data (voice notes for Instagram story videos, processed on our server and not retained) | App Functionality |
| Usage Data → Product Interaction (first-party usage events: event name, random install ID, platform) | Analytics |
| Identifiers → Device ID (random per-install ID for those events and for invites; not the IDFA) | Analytics, App Functionality |

Not declared: the server keeps a daily-rotating keyed hash of the IP (max 30 days) only to rate-limit reports, votes and shares; it cannot be reversed or linked to a user, so it is not collected personal data for either form.

Voice notes on hands (PR #25) stay on the device and are not declared; only Instagram story voice notes are (Audio, processed ephemerally).

PostHog EU (#106, optional): our server forwards usage events (install id, event name, small props; no IP, no free text) to PostHog as our processor. Still Analytics / not linked / not tracking on Apple; on Play, transfers to a service provider acting on our behalf are not "sharing", so "Shared: No" stays.

Exchange rates (Bankroll home-currency PR): the app fetches ECB daily rates from api.frankfurter.app (no key, no user data, cached on device). Nothing about the user is sent, so it adds no row to either form; the third-party request is disclosed in the privacy policy. If the app ever proxies this through our server or adds an identifier, revisit.

App lock (Face ID / passcode, #81) and tax details with receipt photos (#85) stay on the device (photos enter the backup only end-to-end encrypted, which the backup row already covers): no new rows. Swaps (#90) store both nicknames, prizes and payments: covered by Other User Content and Name.

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
- In-App Purchases: create the subscription products in App Store Connect before submitting, attach them to the version, and give each a review screenshot of the paywall. Requires the Paid Apps agreement, bank and tax forms done by Rui.
- EU Digital Services Act trader status: question for Rui. A paid subscription makes the app commercial, which in practice means **trader** (his address and phone shown on the EU listing) unless he publishes through a company.

## Apple: Accessibility Nutrition Labels

Declare only what was tested on an iPhone (source: `/mnt/project-files/design/auditoria-acessibilidade.md` §9). At 174ec64 that is **Dark Interface** only (the app is dark-only). VoiceOver, Larger Text, Sufficient Contrast, Differentiate Without Color and Reduced Motion stay undeclared until the audit's fixes (§1-4, §6, §7) are merged and pass its 10-minute test (§8). The labels are optional and can be added after launch; a false label is grounds for complaints and rejection.

## Google Play: Data safety

- Does the app collect or share user data? **Yes, collects**. Shared with third parties: **No**.
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, `https://{{WEB_DOMAIN}}/delete-account` (Google asks for this URL whenever data is collected, even without accounts).

| Data type | Collected | Optional | Purpose |
|---|---|---|---|
| App activity → Other user-generated content (shared hands, comments, optional cloud backup, optional live session page for backers, optional public profile bio and session cards, optional swaps, optional coaching links and comments, optional action-package agreements, optional cancellation feedback) | Yes | Yes (only when the user shares, comments, turns on backup, shares a session, makes a profile or types feedback) | App functionality, Analytics (feedback only) |
| Financial info → Other financial info (amounts the user publishes on a live page, swap, public profile or action package; optional) | Yes | Yes | App functionality |
| Photos and videos → Photos (receipt and tax-form photos, only inside the optional end-to-end encrypted cloud backup) | Yes | Yes | App functionality |
| Personal info → Name (a nickname the user types: comment name, backer page nickname, profile display name and handle, coaching link names) | Yes | Yes | App functionality |
| Financial info → Purchase history | Yes (RevenueCat) | Yes (only subscribers) | App functionality |
| Device or other IDs | Yes (RevenueCat random app user ID; random install ID for usage events and invites) | No | App functionality, Analytics |
| Audio → Voice or sound recordings | Yes (voice notes for story videos) | Yes | App functionality, **processed ephemerally: Yes** |
| App activity → App interactions (first-party usage events) | Yes | No | Analytics |

Processed ephemerally: No, except audio (Yes).

## Google Play: App content declarations

- Privacy policy: `https://{{WEB_DOMAIN}}/privacy`
- Ads: **No ads**.
- App access: all functionality available without special access (paid features: give the reviewer a note that a test subscription can be bought with Play's license testers).
- Target audience: **18 and over only**.
- Content rating (IARC): category "Utility, Productivity, Communication, or Other" (not Game). No real or simulated gambling. Users can interact / share content: **Yes**. Digital purchases: **Yes**.
- Financial features: **None**. News: No. Health: No. Government: No.
- Real-money gambling, games and contests: **No**.
- Account deletion: not applicable (no accounts). If Play still shows the question, answer "My app does not allow users to create an account".

## Permissions as built (prebuild at cd6635d)
- iOS usage strings: Camera, Photo Library, Face ID, Microphone (PT and EN). UIBackgroundModes: fetch, processing only (stray `audio` removed at 61cf15f).
- Android: INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, USE_BIOMETRIC / USE_FINGERPRINT, VIBRATE (plus POST_NOTIFICATIONS from expo-notifications if the merged manifest keeps it). No location, no storage, no SYSTEM_ALERT_WINDOW. The Data safety rows above match: no location, contacts or files declared; audio only for story voice notes; photos only inside the encrypted backup.
