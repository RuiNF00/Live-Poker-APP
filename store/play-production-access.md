# Google Play: production access answers (draft)

Only needed if Rui's Play account is personal and was created after 13 Nov 2023 (checklist question 3). After 14 days of closed testing with at least 12 opted-in testers, Rui clicks Dashboard → **Apply for production** and pastes these answers (checklist step 27). The answers are in English because the Play Console asks in English.

The questions below follow the Play Console form as documented in 2024–2026. If the wording on the day differs, keep the substance. Fill the `[…]` gaps from the day-7 and day-14 feedback forms (`/mnt/project-files/launch/programa-beta.md` §4) and from the Play Console tester numbers. Never invent numbers: if a gap has no data, say less.

## About your closed test

**1. How easy was it to recruit testers for your app?** Pick the honest option (probably "Neither easy nor difficult"), then:

> Our testers are live poker players from the developer's own playing circle in Portugal, plus a few friends who play home games. Most live players in Portugal use iPhones, so we asked each person for their phone first and recruited Android users specifically. [N] testers opted in; [N] stayed installed for the full 14 days.

**2. Describe the engagement you received from testers during your closed test.**

> We ran a daily task in a WhatsApp group for 14 days (2–5 minutes each: log a hand, replay it, share it as a link, run a live session with the tournament clock, add a trip expense, export a report). [N] testers opened the app on at least [N] of the 14 days, according to our day-7 and day-14 forms. [N] used it at the table during real live sessions, which is the situation the app is built for. In total testers logged [N] hands and [N] sessions (from our own first-party event counts, no personal data).

**3. Provide a summary of the feedback you received from testers, and how you collected it.**

> We collected feedback with an anonymous Google Form on day 7 and day 14 (10 questions: hand-entry speed 1–5, what nearly made them give up, what they liked most, what is missing to use it every session, crashes or data loss, likelihood to recommend 0–10), plus messages in the testers' group. Main points: [top 3 from Q5/Q7, e.g. "hand entry for multiway pots needed fewer taps", "wanted the tournament level reminder on the lock screen"]. Average hand-entry speed rating: [x]/5. Recommendation score: [x]/10. Crashes or data loss reported: [none / list].

## About your app

**4. Who is the intended audience of your app?**

> Adults (18+) who play poker live, in card rooms, casinos and at festivals, and want to keep records of their hands, sessions and results. Live play leaves no hand history, so these players today use notes apps and spreadsheets. The app is rated 18+ and contains no gambling: no real-money play, no betting, and no money moves through the app.

**5. Describe how your app provides value to users.**

> Sweatbook is a notebook for live poker. A player logs a hand in a few taps between levels, replays it street by street, and shares it as a link that opens in any browser so friends and coaches can comment. Around that it keeps sessions (with a tournament clock and the stack on the lock screen), bankroll in several currencies, trip expenses, tournament ROI, notes on opponents, and written records of the deals players make in person with backers and friends. It works offline at the table and needs no account. Records and study only.

**6. How many installs do you expect your app to have in your first year?** Pick **"0 – 10K"**. Our plan is word of mouth from shared hands at festivals, with no paid ads at launch (`/mnt/project-files/marketing/estrategia-lancamento.md`).

## Production readiness

**7. What changes did you make to your app based on what you learned during your closed test?**

> [List the real fixes merged during the test, each with one line, e.g. "Fixed a crash when ending a session with no breaks", "Reduced taps for an all-in preflop", "Added …". Take them from the integration branch commits between the first closed-test build and the production build.] Each fix went out as a new closed-test build without pausing the test.

**8. How did you decide that your app is ready for production?**

> The same build passed Apple's App Review for the iPhone version [date, if true]. Over the closed test there were [no crashes / N crashes, all fixed] in Android vitals, testers rated hand entry [x]/5, and every flow on the daily task list was completed by at least [N] testers. We also have automated tests for the hand format, sync, imports and the free/Pro limits, a release check script that runs before every store build, and a regression pass on each build.

## Before Rui pastes this

- Every `[…]` filled from real data, or the sentence removed.
- Question 8: keep the App Review sentence only if the iPhone version was approved.
- Testers must still be opted in on the day he applies; the 14 days count only days with at least 12 opted in.
