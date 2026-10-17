# Screenshot plan

## Sizes

| Store | Required | Size (portrait) | Count |
|---|---|---|---|
| App Store | iPhone 6.9" | 1320 × 2868 | 3 to 10, we ship 10 |
| App Store | iPad 13" | only if `supportsTablet` is true; it is false for v1 | — |
| Google Play | Phone | 1080 × 1920 (Play caps the long side at 2× the short side), PNG/JPEG < 8 MB | 2 to 8, we ship 8 (frames 1..8) |
| Google Play | Feature graphic | 1024 × 500 | 1 |
| Google Play | Icon | 512 × 512 PNG, 32-bit | 1 |
| App Store | Icon | 1024 × 1024 PNG, no alpha (taken from the build) | 1 |

Apple scales the 6.9" set down for smaller iPhones, so one set is enough.

## The ten frames

Each frame: real app screen inside a device frame, short caption on top, the brand's background colour. Captions in PT-PT, EN, PT-BR and ES (one set per locale; pt-BR and es captions come from `/mnt/project-files/i18n/legendas-capturas.json` and are rendered with the app in that language). Google Play keeps 1..8.

| # | Screen | Caption EN | Legenda PT |
|---|---|---|---|
| 1 | Hand entry mid-action, card picker open (`/hand/new`) | Log a hand in seconds | Regista uma mão em segundos |
| 2 | Replayer at showdown, run it twice with both boards (`/hand/h7`) | Replay every street, even run it twice | Revê cada rua, até o run it twice |
| 3 | Instagram Story of a hand, question mode (`/story/h1`) | Share it and ask your friends | Partilha e pede a opinião dos amigos |
| 4 | Hand list with filter chips (`/`) | Find any hand later | Encontra qualquer mão depois |
| 5 | Live tournament session: clock, stack, level, table notes (`/session`) | Tournament and level, remembered | Torneio e nível, sempre guardados |
| 6 | Tournament results: ROI, ITM, biggest scores (`/tournament-stats`) | ROI and ITM for every tournament | ROI e ITM de cada torneio |
| 7 | Bankroll balance, rules and tools (`/bankroll`) | Your bankroll, no spreadsheets | O teu bankroll sem folhas de Excel |
| 8 | Festival trip with result after expenses (`/trips/t1`) | The whole trip, expenses included | A viagem toda, despesas incluídas |
| 9 | Festival recap Story card (`/festival-card/t1`) | Wrap up the festival in one Story | Fecha o festival com uma Story |
| 10 | Players I back: what each one owes (`/backing`) | Everyone you back, in one place | Quem bancas, tudo num só sítio |

Frame 1 is the one most people see in search results; it must show the speed of entry.

## How they are produced

Rendered from the real app (Expo web build) with seeded demo data, no real event brands or player names:

```bash
npx expo export -p web && npx serve -s dist -l 4173 &   # in the app root
cd store/screenshots && npm i playwright && node render.mjs http://localhost:4173 out
```

`frames.json` holds the route and caption (PT and EN) of each frame, `seed.mjs` the demo hands, sessions and players. Output: `out/{ios,ios-6.5,android}/{pt,en,pt-BR,es}/1..10.png` (10 frames, listed above). Apple takes up to 10; Google Play takes up to 8, so `final/android/` keeps only 1..8. The final set is committed in `store/screenshots/final/` (and mirrored in `/mnt/project-files/launch/screenshots/`): iPhone 6.9" 1320×2868 and 6.5" 1284×2778 (`final/ios-6.5/`; Apple can scale the 6.9" set, the 6.5" one is there if App Store Connect asks for it; no iPad set because `supportsTablet` is false), Play phone 1080×1920, Play feature graphic 1024×500, in PT, EN, pt-BR and es. `frames.json` `drop` removes a control from a frame entirely (used for the Won/Lost filter chips on the hand list, which stay out of store art). Upload order = file number.

A frame can list `hide` strings: web-only hints ("Open the app on your phone to post to Instagram") that the phone never shows are hidden before the shot.

Coordinator rule (17 Oct): a frame that opens the hand search must hide the chip row under the box ("Ganhei / Perdi", es "Gané / Perdí", en "Won / Lost"); a frame of the festival session end must hide or crop the amount on "Re-entrar · {valor}". The current 10 frames show neither (frame 4 is the hand list with search closed).

## Feature graphic (Play)

Brand logo + "Log live poker hands in seconds" on brand background, no device frame, nothing important within 15% of the edges.
