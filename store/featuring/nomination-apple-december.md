# App Store featuring nomination: launch on 17 November

Ready to submit the moment the App Store Connect app record exists (Rui's checklist step 14). Submitting needs Rui's yes (checklist step 36). Source draft and background: `/mnt/project-files/launch/destaque-lojas.md`. Every claim below was checked against the integration branch at 179da6c (17 Oct 2026).

Launch date is **17 November 2026** (release at 10:00 Lisbon). The App Launch window runs from launch through the December festival series; the In-App Event below stays on the December dates. Apple asks for 6 to 8 weeks of notice, so this goes in as soon as Rui says yes: on 18 October there are 4 weeks left.

Where: App Store Connect → Apps → Sweatbook → **Featuring → Nominations → Create nomination** (or the App Store Connect API with the Admin key from step 15, if it accepts nominations for this account).

## Nomination fields

| Field | Value | Length |
|---|---|---|
| Name (internal) | `Sweatbook launch - live festival season` | 39/60 |
| Type | App Launch | |
| Start date | 2026-11-17 | |
| End date | 2026-12-17 | |
| Countries | All launch countries in `store/availability.md` (everything except France, mainland China, Russia and the default exclusions listed there). Priority: United States, United Kingdom, Canada, Australia, Portugal, Brazil | |
| Platform | iOS (iPhone) | |
| Languages | English (U.S.), Portuguese (Portugal), Portuguese (Brazil), Spanish (Spain), Spanish (Mexico) | |
| Pre-order | No | |
| Linked In-App Event | "Your festival diary" (below) | |

**Description** (953/1000):

> Sweatbook is a new notebook for people who play poker live, in casinos and at festivals, where there is no hand history. It launches on 17 November, just before thousands of players travel to the winter festival season, including a two-week high-stakes series in the Bahamas in December. Players log a typical hand in 11 taps between levels, replay it street by street with pot and stack sizes, and share it as a link that opens a replayer in any browser, so friends and coaches can comment without installing anything. Around that, Sweatbook keeps the whole trip: sessions, a tournament clock with blinds and M, tournament ROI and ITM, bankroll in several currencies, travel expenses, and records of the deals players make in person with backers and friends. It is records and study only: no money moves through the app, there is no gameplay and no betting. Built in Portugal, it launches in English, Spanish and both European and Brazilian Portuguese.

**Helpful details** (305/500), the version to submit today:

> Built by a live player to use on festival trips. A Live Activity on the Lock Screen and Home Screen widgets show the running session; hands become shareable replays and Instagram Stories; works offline at the table; no account needed. 18+ rating. The free tier logs 3 hands a day and shares without limit.

Accessibility clause, **unverified**: add it back after "Instagram Stories; " only for the parts a real-device check passes (it would make the text 395/500):

> VoiceOver for hand entry and the replayer, text that scales up to 200% and Reduce Motion; 

- VoiceOver and Reduce Motion: only after Rui or a beta tester runs part 1 of `launch/roteiro-acessibilidade-beta.md` on a real iPhone (the Simulator run at 15:49 could not check them).
- "text that scales up to 200%": only once Registo's fix for the Nova mão seats at 200% is merged (the Simulator showed them tight).

**Supporting materials** (up to 5 URLs, no login): add only what is live on submission day.
1. `https://sweatbook.poker` (after Rui's site steps 5 to 9).
2. A shared sample hand: `https://sweatbook.poker/h/...` (the Início → "Ver uma mão de exemplo" → "Partilhar com amigos" link).
3. Press page `https://sweatbook.poker/press` (#113, when merged and deployed).
4. 30-second hand-entry video (Plano de lançamento thread), if ready.

## In-App Event (Special Event)

| Field | Value | Limit |
|---|---|---|
| Reference name | Festival diary December 2026 | 64 |
| Event name | Your festival diary | 19/30 |
| Short description | Log every hand and share the big ones. | 38/50 |
| Long description | Log every hand between levels, keep your stack on the Lock Screen and close the trip with a recap Story. | 104/120 |
| Badge | Special Event (never Competition or Challenge: no contests) | |
| Event start / end | 2026-12-02 to 2026-12-17; publish start 2026-11-25 | |
| Deep link | `sweatbook://session` | |
| Purpose | Appropriate for all users | |
| Priority | Normal | |
| Media | Event card 1920×1080 and event details 1080×1920, no casino photos, chips or prize amounts. To render from the app like the screenshots (session screen with the Live Activity), once the record exists | |

## Checks before submitting

- **Bahamas** names a place, not an event. If Rui prefers, use "a two-week high-stakes series in the Caribbean" (the description stays under 1000).
- Claims verified at 179da6c: tournament mode with blinds/level clock and M (`src/app/tournament.tsx`, session screen), tournament ROI/ITM (`src/app/tournament-stats.tsx`, #127), Live Activity and home widget (`src/lib/lock-screen/`, `src/lib/home-widget/`), multi-currency bankroll, trip expenses (`src/app/trips/`), festival recap Story (#135), free tier 3 hands/day and unlimited shares (`src/billing/plans.ts` `handsPerDay: 3`, `sharesPerDay: null`).
- pt-BR and es shipped with #131 (merged at 174ec64), so the text says the app launches in all four. Countries with priority can add Brazil, Spain and Mexico's local editorial teams.
- Accessibility claims (VoiceOver hand entry #151, Reduce Motion in the replayer #121/#144, text up to 200% #144, all merged by fbdc87f) are in the code. Before submitting, Rui or a beta tester runs part 1 (VoiceOver) of QA's `launch/roteiro-acessibilidade-beta.md` on a real iPhone (the cloud and the iPhone thread cannot drive VoiceOver); drop any phrase whose step fails. The same test decides the Accessibility Nutrition Labels (`privacy-forms.md`).
- "11 taps" is a typical hand (open, a call, c-bet, fold), covered by src/poker/__tests__/entry-taps.test.ts; a hand to showdown is 15, so always say "typical".
- A nomination does not guarantee featuring and does not affect App Review.

## Timeline after December (Brazilian Portuguese update)

| By | What | Draft |
|---|---|---|
| end of December 2026 | App Store "App Enhancements" nomination for the pt-BR update | `launch/destaque-lojas.md` §5 |
| D−21 before the Brazilian summer festival | pt-BR In-App Event submitted (Special Event, never Competition) | `marketing/lancamento-brasil.md` §5 |
| about 1 January 2027 | Google Play featuring form for the pt-BR update (3 weeks' notice) | `launch/destaque-lojas.md` §5 |

The festival date comes from `research/calendario-festivais.md` once it's official. Each submission needs Rui's yes, like step 36.

## Timeline for the Spanish update (`marketing/lancamento-espanhol.md` §9)

| By | What |
|---|---|
| end of January 2027 | App Store "App Enhancements" and Google Play featuring nominations for the es update |
| D−21 before the es launch date | es In-App Event (draft in `lancamento-espanhol.md` §6) |
| with the es launch | App Store Custom Product Page in Spanish and a Play custom store listing for Spain, Mexico and Argentina |
| after the Brazil price test has a result | Rui's question: apply the local price in Mexico and Argentina if it wins in Brazil (recommended), or stay on automatic prices |

## Google Play

Not for December (new apps need 8 weeks' notice, the build must already be in the Play Console and there are no ratings yet). The Play nomination goes with the pt-BR update at the end of January, submitted around **1 January 2027**; draft in `/mnt/project-files/launch/destaque-lojas.md` §5.
