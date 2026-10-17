# Screenshot plan

## Sizes

| Store | Required | Size (portrait) | Count |
|---|---|---|---|
| App Store | iPhone 6.9" | 1320 × 2868 | 3 to 10, we ship 7 |
| App Store | iPad 13" | only if `supportsTablet` is true; it is false for v1 | — |
| Google Play | Phone | 1080 × 1920 (Play caps the long side at 2× the short side), PNG/JPEG < 8 MB | 2 to 8, we ship 7 |
| Google Play | Feature graphic | 1024 × 500 | 1 |
| Google Play | Icon | 512 × 512 PNG, 32-bit | 1 |
| App Store | Icon | 1024 × 1024 PNG, no alpha (taken from the build) | 1 |

Apple scales the 6.9" set down for smaller iPhones, so one set is enough.

## The six frames

Each frame: real app screen inside a device frame, short caption on top, the brand's background colour. Captions in PT-PT and EN (one set per locale).

| # | Screen | Caption EN | Legenda PT |
|---|---|---|---|
| 1 | Hand entry mid-action, card picker open | Log a hand in seconds | Regista uma mão em segundos |
| 2 | Replayer on the river, pot and stacks shown | Replay every street | Revê cada rua |
| 3 | Share sheet + the web replayer on a friend's phone | Share with a link. No install needed | Partilha com um link. Sem instalar nada |
| 4 | Tag picker on a saved hand | Tag the hands that matter | Marca as mãos que interessam |
| 5 | Tournament / session view with level and table remembered | Tournament and level, remembered | Torneio e nível, sempre guardados |
| 6 | Hand list filtered by tag | Find any hand later | Encontra qualquer mão depois |

Frame 1 is the one most people see in search results; it must show the speed of entry.

## How they are produced

Rendered from the real app (Expo web build) with seeded demo data, no real event brands or player names:

```bash
npx expo export -p web && npx serve -s dist -l 4173 &   # in the app root
cd store/screenshots && npm i playwright && node render.mjs http://localhost:4173 out
```

`frames.json` holds the route and caption (PT and EN) of each frame, `seed.mjs` the demo hands, sessions and players. Output: `out/{ios,android}/{pt,en}/1..10.png` (10 frames: hand entry, replayer (run it twice), story, hands list, session, bankroll, trip, players, backing, paywall). Apple takes up to 10; Google Play takes up to 8, so `final/android/` keeps only 1..8. The final set is committed in `store/screenshots/final/` (and mirrored in `/mnt/project-files/launch/screenshots/`): iPhone 6.9" 1320×2868 (Apple scales it to the smaller iPhones; no iPad set because `supportsTablet` is false), Play phone 1080×1920, Play feature graphic 1024×500, PT and EN. Upload order = file number.

Frames: 1 hand entry, 2 replayer, 3 Instagram story share, 4 hand list with tags, 5 live session, 6 bankroll, 7 player notes.

## Feature graphic (Play)

Brand logo + "Log live poker hands in seconds" on brand background, no device frame, nothing important within 15% of the edges.
