# Mona Patrol

A 2D lunar buggy arcade game starring Mona the Octocat, inspired by Irem's 1982 arcade game
Moon Patrol. Leap merge-conflict craters, blast lunar boulders ahead and bug saucers overhead,
and race through checkpoints **A** to **Z**.

## Play

Mona Patrol is not published online yet while this repository remains private. When published,
it will join [GitHub Arcade](https://jdooley-clt.github.io/arcade/).

To play right now on your machine, run the local preview server (see [Local dev](#local-dev)).

## Controls

| Action | Control |
| --- | --- |
| Start / resume / replay | `Enter`, `Space`, or **Start patrol** button |
| Speed up / slow down | `←` / `→`, `A` / `D`, or **Slower** / **Faster** touch buttons |
| Jump craters and mines | `Space`, `↑`, `W`, or **Jump** touch button |
| Fire forward + upward cannons | `Z`, `X`, `Ctrl`, or **Fire** touch button |
| Pause / resume | `P`, `Esc`, or **Pause** button |
| Toggle audio (starts off) | `M` or **Audio** button |
| Restart from Point A | `R` or **Restart** button |
| Theme / instructions | **Dark mode** and **Help** (`?`) buttons |

Optional gamepads are also supported (left stick or D-pad for speed, south button to jump,
west/east/trigger to fire, Start to begin or pause).

## How it plays

- **Five distinct stages & backgrounds**:
  1. **`A–E` Lunar Crater Ridge (`main`)**: approachable opening run across boulders and craters.
  2. **`F–J` Octo Metropolis (`release`)**: sunlit city spires and varied-speed UFO squadrons.
  3. **`K–O` Canary Minefield (`canary`)**: radar arrays and tricky mine + rock + crater combos.
  4. **`P–T` Rolling Highlands (`hotfix`)**: canyon mesas, sloped hills, and bouncing stones.
  5. **`U–Z` Omega Citadel (`omega`)**: full gauntlet combining every hazard and saucer type.
- **Checkpoint beacons**: reaching any lettered gate awards `+500` points and updates your safe
  respawn point if one of your 3 buggies crashes. Earn an extra buggy at `10,000` points.
- **Sector time & stats summary**: clearing major gates (`E`, `J`, `O`, `T`, `Z`) plays a
  triumphant 8-bit fanfare, shows full section stats, and awards `1,000+` clear points, `80`
  points per second under the 52-second par time, UFO bonuses, and `+1,000` for a flawless run.
- **Hazards & enemies**:
  - **Craters & armored landmines** cannot be shot and must be jumped (`+100` to `+150` pts),
    with Stage 3+ mine combinations rewarding speed and jump timing.
  - **Lunar boulders & rolling stones** can be jumped or blasted (`1` hit for small rocks, `2`
    hits for tall stacks and bouncing highland stones; `+100` to `+250` pts).
  - **Two distinct UFO types**: cyan tri-orb **Bug Droppers** swoop in waves and drop exploding
    bugs, while crimson-gold **CVE Bombers** stalk, hover-telegraph, and drop CVE warheads that
    blast fresh craters into the road. Most enter from the left, with an increasing share entering
    from the right, patrolling back and forth overhead until destroyed.
- **Accessibility & motion**: audio starts muted, focus loss pauses play automatically, an ARIA
  live region announces checkpoints and scores, and `prefers-reduced-motion` disables parallax
  drift and crash shake.

## Local dev

Requires Node.js 22 or newer. The game itself has zero runtime dependencies; `npm install`
installs Playwright and axe-core for browser verification:

```sh
npm install
npm start
```

Open <http://127.0.0.1:4183/> (or set `PORT=4184 npm start` to pick another loopback port).
Run `npm run build` to stage the static site into `_site/`, or `npm run icons` after editing
the pixel map in `scripts/icons.mjs`.

## Tests

```sh
npm test
npm run cabinet:setup
npm run build
npm run test:cabinet
```

- `npm test` runs Node unit tests for jump physics, collisions, checkpoints, time bonuses,
  deterministic course generation, generated icons, static server safety, and documentation.
- `npm run test:cabinet` runs Playwright + `@axe-core/playwright` across desktop Chromium,
  Pixel 7 mobile Chromium, and iPhone 13 mobile WebKit (`1440×900`, `390px`, and `320px`).

## Cabinet compatibility

`scripts/cabinet.mjs` pins `jdooley-clt/arcade` at commit `bc22bcd`
(`bc22bcdf76c378c50abe8b235d105e9d7931e9ba`). `npm run cabinet:setup` fetches that exact commit
into `.playwright-cabinet`, and `scripts/serve-cabinet.mjs` mounts the cabinet at `/arcade/`
and `_site/` at `/mona-patrol/` on one origin to verify launch, keyboard/touch input, iframe
focus, standalone backlink hiding, reduced motion, and teardown.

Draft catalog metadata and artwork live in `cabinet/` for review before public registration.

## Origins

Created by Jeramiah Dooley ([@jdooley-clt](https://github.com/jdooley-clt)) for the
[GitHub Arcade](https://jdooley-clt.github.io/arcade/), a cabinet created by Christina Warren
([@filmgirl](https://github.com/filmgirl)).

Independent fan project. Not affiliated with GitHub.

## Licensing

Original code, styles, illustrations, and synthesized Web Audio are licensed under the
[MIT License](LICENSE) (`Copyright (c) 2026 Jeramiah Dooley`). See [NOTICE](NOTICE) for GitHub
Octocat artwork terms (<https://octodex.github.com/faq/>) and trademark exclusions.

