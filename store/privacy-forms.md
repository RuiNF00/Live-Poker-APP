# Store forms: ready answers

Based on v1 as built (confirmed by the app thread, 2026-10-17): **no accounts, no sign-in, no third-party analytics/ads/crash SDKs**, all hand data local on the device. Only a hand the user chooses to share (public link) and anonymous comments/votes on it reach our backend (Supabase). Subscriptions via Apple/Google in-app purchase through RevenueCat (products sweatbook_pro_monthly 29.99 USD, sweatbook_pro_annual 199.99 USD, 1-week free intro, group "Sweatbook Pro"). The app sends first-party usage events (event name, random per-install ID, platform; no personal data) to `https://{{WEB_DOMAIN}}/api/events`. If any of this changes (crash reporter, analytics, RevenueCat, accounts), update this file and the privacy policy together.

## Apple: App Privacy ("nutrition label")

Data used to track you: **None**. Data linked to you: **None**.

Data not linked to you:

| Category → type | Purpose |
|---|---|
| User Content → Other User Content (shared hands, comments) | App Functionality |
| Purchases → Purchase History (RevenueCat receives receipts) | App Functionality |
| Identifiers → User ID (RevenueCat anonymous app user ID, random, not tied to identity) | App Functionality |
| Audio Data (voice notes for Instagram story videos, processed on our server and not retained) | App Functionality |
| Usage Data → Product Interaction (first-party usage events: event name, random install ID, platform) | Analytics |
| Identifiers → Device ID (random per-install ID for those events; not the IDFA) | Analytics |

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
- Export compliance: exempt encryption only (`ITSAppUsesNonExemptEncryption=false` in app.json).
- Sign-in required: No. No demo account needed. Review notes in `review-risks.md`.
- In-App Purchases: create the subscription products in App Store Connect before submitting, attach them to the version, and give each a review screenshot of the paywall. Requires the Paid Apps agreement, bank and tax forms done by Rui.
- EU Digital Services Act trader status: question for Rui. A paid subscription makes the app commercial, which in practice means **trader** (his address and phone shown on the EU listing) unless he publishes through a company.

## Google Play: Data safety

- Does the app collect or share user data? **Yes, collects**. Shared with third parties: **No**.
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, `https://{{WEB_DOMAIN}}/delete-account` (Google asks for this URL whenever data is collected, even without accounts).

| Data type | Collected | Optional | Purpose |
|---|---|---|---|
| App activity → Other user-generated content (shared hands, comments) | Yes | Yes (only when the user shares or comments) | App functionality |
| Financial info → Purchase history | Yes (RevenueCat) | Yes (only subscribers) | App functionality |
| Device or other IDs | Yes (RevenueCat random app user ID; random install ID for usage events) | No | App functionality, Analytics |
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
