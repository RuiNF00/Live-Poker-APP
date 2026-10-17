# Availability (countries) for v1

Source: /mnt/project-files/research/mercados-linguas.md and store/review-precheck.md (export compliance).
I set this through the APIs once the keys exist (App Store Connect API `appAvailabilities` with the Admin key from step 15; Play `edits.countryavailability` / track country targeting with the service account from step 20). Rui only confirms it at step 28.

## Excluded in v1 (both stores)
| Territory | Why |
|---|---|
| France | The cloud backup encrypts in the app (AES-256-GCM), which needs a French encryption declaration to ANSSI first. Optional step 30 lifts this. |
| Mainland China | Apple requires an ICP filing for every new app there, Google Play is not available, and poker content is a review risk. |
| Russia | Payments to Russia are suspended on both stores; sanctions risk. |

## Also excluded by default (Rui can switch them back on)
Gulf states (United Arab Emirates, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman), Brunei, Pakistan, Bangladesh, Indonesia. Gambling is banned there and there is no live poker scene, so the app gains nothing and adds review/complaint risk. This is a judgment call, not a store rule.

## Everything else
Available, including the US (all states), Canada, the UK, the EU except France, Brazil, Mexico, Latin America, Australia, Asia ex-China.

## Languages
v1 metadata: PT-PT (primary) and EN-US (App Store also EN-GB copy of EN-US). PT-BR, ES-ES and ES-MX listings can be added without code changes when the translation thread delivers them; the app UI itself stays PT/EN and follows the device language (others fall back to EN).
