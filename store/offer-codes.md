# Free Pro codes for trusted players (Bahamas, Dec 2026)

Free Pro only, never tied to cash or results. 5–10 players and stable managers. Codes go out by hand (DM / in person); never post them publicly.

## App Store: subscription offer codes (store thread does this with the step 15 API key)
- Subscription `sweatbook_pro_annual` → Offer codes → one-time-use codes.
- Offer: **Free, 3 months**, new and existing (lapsed) subscribers, max 1 redemption per customer.
- Batch: 10 codes, expiry 31 Jan 2027. Name `bahamas-2026`.
- API: `POST /v1/subscriptionOfferCodes` (offer, free, 3 months, eligibilities) then `POST /v1/subscriptionOfferCodeOneTimeUseCodes` (numberOfCodes 10, expirationDate). The codes CSV is downloaded from the response endpoint and saved to `/mnt/project-files/launch/codigos-pro/` (private, not in git).
- Manual fallback in App Store Connect: Apps → Sweatbook → Subscriptions → Sweatbook Pro → Pro anual → Subscription Prices → Offer Codes → + → Free, 3 months → Create → Generate one-time use codes → 10 → Download.
- Redeem: App Store → account → Redeem gift card or code, or the link `https://apps.apple.com/redeem?ctx=offercodes&id=<APP_ID>&code=<CODE>`. RevenueCat picks it up as a normal subscription with a free offer period.
- Limit: Apple allows up to 1,000,000 codes per quarter; one-time codes need the app to be live (approved) to redeem.

## Google Play: promo codes (Play Console only, no API: Rui, checklist step 34)
- Play Console → Sweatbook → Monetize with Play → Products → Promo codes (or "Promotions") → Create promotion → Type **Subscription**, product `sweatbook_pro_annual`, free trial period **3 months** (custom free-trial promo), quantity 10, end date 31 Jan 2027 → Create → Download CSV → save to `Projetos-Claude/sweatbook-chaves/codigos-pro-android.csv`.
- Redeem: Play Store → profile → Payments & subscriptions → Redeem code, or `https://play.google.com/redeem?code=<CODE>`.
- Promo codes only work once the app is published on a track the user can install from (for a closed test, the person must also be a tester).

## Rules
- Never in exchange for money, rakeback, action or results; never mention it in public posts.
- Keep a list of who got which code (name, store, date) in the private CSV, so a leaked code can be traced.

## Beta testers' codes (programa-beta.md)
The beta plan gives each tester 1 year of Pro on launch day. That is a separate batch from the Bahamas 3-month codes. Apple subscription offer codes allow free durations up to 1 year, so a "Free, 1 year" code on `sweatbook_pro_annual` works. On Google Play, check the longest free period the promo-code form allows on the day; if it is shorter than a year, use the longest allowed and tell the testers. The 3-day trial on the annual plan (Rui, 17 Oct) doesn't affect codes.

## Batches (17 Oct)
| Batch | For | Apple (created by the store thread via the ASC API) | Google Play (Rui, step 34) |
|---|---|---|---|
| Bahamas | 5 to 10 trusted players | 10 codes, 3 months free on `sweatbook_pro_annual` | 10 codes, 3 months |
| Creators | about 20 creators (marketing/criadores.md, strategy §6.2 item 5) | 20 codes, 3 months free | 20 codes, 3 months |
| Beta testers | each tester, on launch day (programa-beta.md) | one per iPhone tester, 1 year free | one per Android tester, longest free period allowed (up to 1 year) |

All batches are free Pro only, never tied to money or a contest, and nobody is contacted until Rui decides. One code per person; keep the CSVs in `Projetos-Claude/sweatbook-chaves/`, never in the repo or the chat.
