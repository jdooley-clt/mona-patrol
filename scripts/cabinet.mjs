import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Pinned Commit Cabinet commit (`83f4bcd` on jdooley-clt/arcade main).
export const cabinetSha = '83f4bcdf6524aa445a7d0fce60e45aea7ffb8b55';
export const cabinetRoot = resolve('.playwright-cabinet');
export const siteRoot = resolve('_site');
export const cabinetDraftRoot = resolve('cabinet');
export const port = Number(process.env.CABINET_PORT || 4267);
export const origin = `http://127.0.0.1:${port}`;

export const fixtureEntry = {
  id: 'mona-patrol',
  title: 'Mona Patrol',
  description:
    'Drive Mona across lunar craters, mines, and rolling hills while battling Bug and CVE saucers from A to Z.',
  category: 'Lunar buggy patrol',
  url: '/mona-patrol/',
  repository: 'https://github.com/jdooley-clt/mona-patrol',
  art: './assets/mona-patrol.png',
  coverArt: './assets/mona-patrol-cover.svg',
  coverCharacter: './assets/mona-patrol-character.svg',
  accent: 'lavender',
  controls: [
    { keys: 'Enter / Space / Start', action: 'Start or resume patrol' },
    { keys: 'Left / Right or A / D', action: 'Shift buggy speed (Slow, Cruise, Boost)' },
    { keys: 'Space / Up / W / Jump', action: 'Jump craters, mines, and rolling stones' },
    { keys: 'Z / X / Ctrl / Fire', action: 'Fire forward laser and upward anti-air cannon' },
    { keys: 'P / Esc', action: 'Pause or resume' },
    { keys: 'M / Audio', action: 'Toggle chiptune music and sound effects' },
  ],
  instructions:
    'Leap lunar craters and Stage 3+ landmine combinations, blast craggy boulders and Stage 4+ rolling stones, and shoot down swooping Bug Droppers and crater-carving CVE Bombers overhead across checkpoints A to Z. Audio starts off; use the game’s own sound, stage, theme, and touch controls.',
  viewport: { layout: 'document', height: 980, mobileHeight: 900 },
};

export function verifyCabinet() {
  const git = (...args) =>
    execFileSync('git', ['-C', cabinetRoot, ...args], { encoding: 'utf8' }).trim();
  if (git('rev-parse', 'HEAD') !== cabinetSha || git('status', '--porcelain')) {
    throw new Error(
      `Cabinet must be a clean checkout of ${cabinetSha}. Remove ${cabinetRoot} and run npm run cabinet:setup.`,
    );
  }
}

export function candidateCatalog(original) {
  const catalog = structuredClone(original);
  const existing = catalog.find((game) => game.id === 'mona-patrol');
  if (existing) {
    Object.assign(existing, structuredClone(fixtureEntry));
  } else {
    catalog.push(structuredClone(fixtureEntry));
  }
  return catalog;
}
