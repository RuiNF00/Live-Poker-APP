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
- Review notes (paste into App Review Information → Notes; 4000-character limit, this one is 3513; checked against v1 d69a7aee and src/i18n/en.ts). Drop the LOCK SCREEN paragraph if the submitted build has no App Group, and the Live Activity buttons sentence if #328 is not in. The links need the site live. Play "App access" text and the related answers: /mnt/project-files/launch/notas-revisao.md.

  > Sweatbook is a notebook for live (in-person) poker players: they record hands and sessions they played and replay them to study. No gameplay, no real-money or simulated gambling, no betting, no ads, no links to gambling operators. No account or sign-in. Rated 18+. The app follows the device language (Portuguese, Spanish, English).
  >
  > HOW TO TEST: on Hands, "See an example hand" opens the replayer. Log a hand with + (about ten taps), open it and tap Share: the link opens a web replayer with comments and votes. Session > "New session" > Start runs a live session with any name; Session > Festivals lists published schedules, and "Start a session" on an event fills in the tournament.
  >
  > LOCK SCREEN: start a live session (tournament with a level length, or cash) and lock the iPhone. A Live Activity shows time played, stack and level, also in the Dynamic Island; its buttons (Pause, Rebuy, Share stack) open the app. It ends when the session is saved. A Sweatbook widget (small or medium) shows the running session or the week's result.
  >
  > IN-APP PURCHASES (testable with any Sandbox Apple Account, nothing to configure): Sweatbook Pro monthly, or yearly with a 3-day free trial, and a one-time Lifetime purchase. Free allows 3 new hands a day. The paywall appears on locked features, e.g. a 4th new hand in a day, Bankroll > filters, a second bankroll or trip, insights, month comparison, a face or voice on a hand video, the PDF report, or the "Sweatbook Pro" card in Settings. The trial is offered once, after the first saved session or hand, never at first launch. Lifetime (sweatbook_lifetime) is only in the cancel flow: with a sandbox subscription, Settings > "Manage subscription" > "I don't want a subscription"; the retention offer (sweatbook_retention_40) is on the same screen under "It doesn't fit my bankroll right now". Cancelling in the App Store is one tap away at each step. Restore purchases is on the paywall and in Settings; offer codes in Settings > "Redeem code".
  >
  > CAMERA AND MICROPHONE: the camera photographs receipts and tax forms; on iPhone it also records the player's face only when they tap "Record with your face" on a hand video (hand > Share > Instagram story > Video). That clip (up to 30 s) is used once to render the video on our server, then deleted on the phone and the server; no face recognition. The microphone records voice notes and the sound of these videos.
  >
  > USER CONTENT: only comments on hands shared by link, plus an optional public profile. No chat, forum or messaging. A word filter runs before anything is published. Every comment and received hand has a one-tap Report; we are alerted on the first report, content is hidden after repeated reports and reviewed within 24 hours. The owner of a shared hand can delete any comment or block its author; recipients can block a commenter or remove a hand. To test: share a hand, open the link in a browser and post a comment (Report is under it), then in the app tap Block or Delete under that comment.
  >
  > STAKING, SWAPS AND BACKER LINKS are record-keeping only, for deals players made in person with people they know. No money moves through the app: no payments, wallets, deposits or payouts, and nobody can look for backers or offer action in the app. Invites give both players 50% off their first Pro month (an App Store offer code) when the friend saves a first hand; they cannot be bought and carry no money.
  >
  > Settings > "Delete all my data" erases the phone and our servers. Support: https://sweatbook.poker/support

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
