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
v1 metadata: EN-US (primary language on both stores, launch/colar-nas-contas.md §1c; Play also gets es-419 and en-GB copies), PT-PT (App Store also EN-GB, a copy of EN-US except its own keywords, `store/listing/en-US.md`), PT-BR (`store/listing/pt-BR.md`), ES-ES (`store/listing/es-ES.md`) and ES-MX / Play es-419 (`store/listing/es-MX.md`). The app UI ships in pt-PT, pt-BR, es and en since #131 (merged at 174ec64) and follows the device language; anything else falls back to English. Screenshots exist for all four (`final/{ios,android}/{pt,en,pt-BR,es}`).
