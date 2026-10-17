# Screenshot plan

## Sizes

| Store | Required | Size (portrait) | Count |
|---|---|---|---|
| App Store | iPhone 6.9" | 1320 × 2868 (1290 × 2796 also accepted) | 3 to 10, we ship 6 |
| App Store | iPad 13" | only if `supportsTablet` is true; it is false for v1 | — |
| Google Play | Phone | 1080 × 1920 to 1440 × 3120, 9:16 to 9:20, PNG/JPEG < 8 MB | 2 to 8, we ship 6 |
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

1. Seed a demo account with ~20 realistic hands (a realistic live tournament, no real event brands or player names).
2. Run the app in the iOS Simulator (iPhone 16 Pro Max, 6.9") and an Android emulator (Pixel, 1080 × 2400), capture with `xcrun simctl io booted screenshot` / `adb exec-out screencap -p`.
3. Compose captions and frames with a script (HTML template + Playwright screenshot at exact pixel size) so changing the brand re-renders every image. This will live in `store/screenshots/` once the app UI exists.
4. Status bar: 9:41, full battery, full signal (`xcrun simctl status_bar booted override ...`).

## Feature graphic (Play)

Brand logo + "Log live poker hands in seconds" on brand background, no device frame, nothing important within 15% of the edges.
