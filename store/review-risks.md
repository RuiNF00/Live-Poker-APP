# Review risks for a poker app, and how we avoid them

Ordered by how likely each one is to block the 24-hour goal.

## 1. Google Play: 12 testers for 14 days (blocks production, not the build)

Personal Play developer accounts created after 13 Nov 2023 cannot publish to production until a closed test has had at least 12 opted-in testers for 14 consecutive days. Organization accounts are exempt.

- If Rui's account is personal and new: production on Play cannot happen in 24 h. The best possible on day 1 is the closed test live, with the 14-day clock started.
- Plan: upload the first build to an **internal** track as soon as it exists (no review), then a **closed testing** track with a Google Group or email list of at least 12 real testers (Rui's poker friends; this doubles as our first share-feature users). After 14 days apply for production access in Play Console (a short questionnaire about the test).
- Testers must opt in through the link and keep it installed; uninstalls during the 14 days can reset the count.

## 2. Apple 4.2 Minimum functionality / 2.1 App completeness

Reviewers reject apps that feel like a demo or crash. v1 must have the full hand-entry → replayer → share loop working with no placeholder screens, no "coming soon" tabs, and no dead buttons. Hide anything unfinished rather than greying it out.

## 3. Apple 5.3 / Play gambling policy (low if we do this right)

A hand tracker is not gambling. Reviewers see "poker" and check for money.

- No in-app purchase of chips, no "play" button, no odds-for-betting tools aimed at casino betting, no links to online poker rooms or affiliates. Any affiliate link would make Play treat it as gambling-related ads and Apple ask for licences.
- Copy says "logging and study tool, no real-money gaming" (already in listing and terms).
- Review notes (paste into App Review Information → Notes):

  > This app is a notebook for players of live (in-person) poker. Users record hands they played at a casino and replay them to study. There is no gameplay, no real-money or simulated gambling and no betting. The only purchase is the optional Sweatbook Pro subscription (monthly, or yearly with a 1-week free trial). No account is needed. The free tier saves 3 hands per day; the Sweatbook Pro paywall appears when saving the 4th hand of the day, when choosing the 30d/90d/1-year or stake bankroll filters, when creating a second bankroll, when recording a voice note or removing the watermark on an Instagram Story, when exporting sessions to CSV in Settings, or from Settings → "Ver o Sweatbook Pro" at any time, and can be tested with a sandbox account. The home screen offers a sample hand ("Ver uma mão de exemplo" / "See a sample hand") that plays in the replayer. To test sharing, log a hand with the + button (about ten taps), open it and tap Share; the link opens a web replayer with comments and votes. Optional cloud backup is in Settings → Cloud backup and needs no account (it gives a recovery code). The app is in Portuguese and English and follows the device language. Comments can be reported and the hand owner can delete the hand with all its comments.

- Avoid casino imagery that suggests play money: no slot icons, chip-stack "win" animations, or "jackpot" wording in screenshots.

## 4. Accounts and in-app purchases

- v1 has no accounts, so in-app account deletion (5.1.1(v)) and Sign in with Apple (4.8) do not apply. If accounts are added later, both become mandatory.
- Subscriptions: paid digital features must use Apple/Google in-app purchase (Apple 3.1.1). The paywall must show price, period, that it auto-renews, how to cancel, and links to the terms and privacy policy (3.1.2), plus a **Restore purchases** button. Free features must work without paying, so the reviewer sees a functional app. Products must be created and attached to the version before submitting, or the review fails.

## 5. User-generated content (Apple 1.2)

Shared hands are public via link and may contain text. Apple requires, for UGC: a way to report objectionable content, a way to block abusive users, and a published contact. Minimum for v1:

- "Report" on the public hand web page and in-app when viewing someone else's hand → email or a Supabase `reports` row.
- Owner can delete a shared hand at any time.
- Comments ship in v1 (web share page, no account, display name + text). Needed: "Report" on each comment, a profanity filter on submit, owner can delete comments on their hand, and rate limiting. Apple's 1.2 also asks for blocking abusive users; for anonymous web comments, owner-side delete + report covers it, but mention it in review notes.

## 6. Trademarks and names (Apple 2.3.7, 5.2)

- Don't use WSOP, EPT, PokerStars, GGPoker etc. in name, subtitle, keywords or screenshots.
- Check the chosen app name on both stores and on EUIPO before reserving it. Apple reserves the name the moment the app record is created, so create the record as soon as the name is picked.

## 7. Privacy accuracy

The privacy label, Data safety form and the policy must match what the SDKs actually send. Before submitting, list the final `package.json` dependencies and confirm nothing adds analytics/ads (e.g. Firebase Analytics turns on collection by default).

## 8. Metadata

- Screenshots must show the real app UI. Captions are fine; mock devices are fine.
- No prices or "free" in the app name or icon. No mention of Android in iOS metadata and vice versa.
- Support URL must load (Apple checks).

## Timing

- Apple review currently takes about 24 h on average, often less. Use **expedited review** only if the first submission is rejected; it is granted once in a while, not on demand.
- TestFlight external testing needs a short beta review (usually a few hours); internal testers (up to 100 App Store Connect users) need none.
