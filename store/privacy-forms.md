# Store forms: ready answers

Answers assume the v1 described in `listing/`: optional account (email / Apple / Google via Supabase), hands synced to Supabase, public share links, a crash reporter, no ads, no analytics SDK, no payments. If the build adds analytics, ads or purchases, update this file and `eas/app-config-for-main-thread.md` together.

## Apple: App Privacy ("nutrition label")

Data used to track you: **None**.

Data linked to you:

| Category → type | Purpose | Linked | Tracking |
|---|---|---|---|
| Contact Info → Email Address | App Functionality | Yes | No |
| Identifiers → User ID | App Functionality | Yes | No |
| User Content → Other User Content (hands, notes) | App Functionality | Yes | No |

Data not linked to you:

| Category → type | Purpose |
|---|---|
| Diagnostics → Crash Data | App Functionality |

Privacy Policy URL: `https://{{WEB_DOMAIN}}/privacy`

## Apple: Age rating questionnaire (2025+ format)

The app is a tracker, not a game. Answer honestly so the rating matches what a reviewer sees:

- Simulated gambling: **None** (you cannot play poker in the app; you record hands played elsewhere).
- Gambling / contests: **No**. Real-money gambling: **No**.
- Mature or suggestive themes, violence, profanity, medical: **None**.
- Alcohol, tobacco, drugs references: **None**.
- User-generated content: **Yes** (shared hands, notes). Requires the in-app means to report and delete content, see `review-risks.md`.
- Messaging / chat: No (unless comments ship; then Yes).
- Web access (unrestricted): No.
- Then set the **age override to 18+**. Rationale: the app is about casino poker and the terms require 18+; an under-rated poker app is a common reason for a review question, an over-rated one never is.

## Apple: other App Store Connect fields

- Content rights: does not contain third-party content.
- Export compliance: uses only exempt encryption (HTTPS) → set by `ITSAppUsesNonExemptEncryption=false`.
- Sign-in required for review? No, core features work without an account. Still give the reviewer a demo account so share/sync can be tested (see `README.md`).
- EU Digital Services Act trader status: see question for Rui in `README.md`.

## Google Play: Data safety

- Does the app collect or share user data? **Yes, collects**. Shared with third parties: **No** (service providers do not count as sharing).
- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, URL `https://{{WEB_DOMAIN}}/delete-account`.

| Data type | Collected | Optional | Purpose |
|---|---|---|---|
| Personal info → Email address | Yes | Yes (account is optional) | Account management, App functionality |
| Personal info → User IDs | Yes | Yes | Account management |
| App activity → Other user-generated content | Yes | No | App functionality |
| App info and performance → Crash logs, Diagnostics | Yes | No | App functionality |

Processed ephemerally: No for all.

## Google Play: App content declarations

- Privacy policy: `https://{{WEB_DOMAIN}}/privacy`
- Ads: **No ads**.
- App access: "All functionality available without special access" if login stays optional; otherwise give the demo account.
- Target audience: **18 and over only**. Appeals to children: No.
- Content rating (IARC): category "Utility, Productivity, Communication, or Other" (not Game). Gambling questions: no real gambling, no simulated gambling. Users can interact / share content: Yes. Expected result: PEGI 3 / ESRB Everyone, regardless of the 18+ target audience.
- News app: No. Government app: No. Health: No. Financial features: **None** (a bankroll log is not a financial service; if Play asks, answer "No financial features").
- Real-money gambling, games and contests declaration: **No**.
- Account deletion: in-app path + web URL above.
- Data safety: as above.
