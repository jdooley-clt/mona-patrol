// True 8-bit stepped pixel-art 2D Canvas renderer for Mona Patrol.
// Features 5 distinct stage palettes & architectural sceneries (A–E Ridge, F–J Octo Metropolis
// spires, K–O Canary Radar Minefield, P–T Rolling Highlands, U–Z Omega Citadel), canonical
// Pixel Mona in her 6-wheel rover, Tri-Pod Bug-Dropper UFOs, Armored CVE Crater-Bombers,
// tricky landmines, and 4-frame tumbling highland boulders.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GROUND_Y,
  GEARS,
  groundYAt,
  sectorCheckpointLetters,
} from './engine.js';

const PX = 2;
const snap = (v) => Math.round(v / PX) * PX;

// Five distinct stage themes (both Light Candy 8-Bit and Dark Retro Arcade CRT variants)
const STAGE_THEMES = [
  // Stage 1 (A–E): Lunar Crater Ridge
  {
    light: {
      sky: '#fff7df', skyBand: '#f7efd4', starA: '#ded4f1', starB: '#ffb7a5',
      farMtn: '#ded4f1', farShade: '#c3b2e3', midHill: '#c5e7b1', midShade: '#9ed097',
      roadTop: '#ffb7a5', roadMid: '#e89592', roadDeep: '#d8cde9', pebble: '#c97879', craterPit: '#f3e8cc',
    },
    dark: {
      sky: '#181626', skyBand: '#211d33', starA: '#fffdf4', starB: '#96dce2',
      farMtn: '#3f3459', farShade: '#2e2544', midHill: '#2d574b', midShade: '#224239',
      roadTop: '#e89592', roadMid: '#b56974', roadDeep: '#362e4d', pebble: '#7d4454', craterPit: '#110e1b',
    },
  },
  // Stage 2 (F–J): Octo Metropolis — teal/blue peaks, green bulbous city spires w/ sunlit gold edges, amber soil
  {
    light: {
      sky: '#e6f6ff', skyBand: '#d2eefc', starA: '#96dce2', starB: '#f5cc66',
      farMtn: '#9ec5f8', farShade: '#7aaae8', midHill: '#7fd19e', midShade: '#5eb882',
      roadTop: '#f7ba79', roadMid: '#e59856', roadDeep: '#d6c5e8', pebble: '#c27638', craterPit: '#dff0fa',
    },
    dark: {
      sky: '#0c1228', skyBand: '#141f42', starA: '#96dce2', starB: '#f7d274',
      farMtn: '#1b3b7a', farShade: '#132a59', midHill: '#256d4b', midShade: '#1b5238',
      roadTop: '#f09d51', roadMid: '#c4742f', roadDeep: '#2e294a', pebble: '#8c4c19', craterPit: '#080d1f',
    },
  },
  // Stage 3 (K–O): Canary Minefield — sunset peach/violet sky, plum cliffs, radar dishes, golden-sand road
  {
    light: {
      sky: '#ffefe6', skyBand: '#fde1d3', starA: '#ed9eb7', starB: '#f5cc66',
      farMtn: '#e8b8d4', farShade: '#d19ab9', midHill: '#f5d491', midShade: '#e0bc72',
      roadTop: '#f2c97d', roadMid: '#dba858', roadDeep: '#d9c6cf', pebble: '#b58238', craterPit: '#f9e5d8',
    },
    dark: {
      sky: '#241326', skyBand: '#331b36', starA: '#ffb7a5', starB: '#f7d274',
      farMtn: '#592c54', farShade: '#42203e', midHill: '#634b2b', midShade: '#4d391f',
      roadTop: '#e0b25b', roadMid: '#b08235', roadDeep: '#3b263d', pebble: '#78531b', craterPit: '#1a0d1c',
    },
  },
  // Stage 4 (P–T): Rolling Highlands — glacier aqua sky, indigo terraced mesas, undulating mint-slate hills
  {
    light: {
      sky: '#e8faf6', skyBand: '#d4f3ec', starA: '#8a6fb3', starB: '#7fd19e',
      farMtn: '#b9c8f0', farShade: '#9ab0e3', midHill: '#9de0d0', midShade: '#7ac7b5',
      roadTop: '#d7b8f3', roadMid: '#b894db', roadDeep: '#c2d6e8', pebble: '#8d6ab5', craterPit: '#daf2ec',
    },
    dark: {
      sky: '#0f1f29', skyBand: '#162d3b', starA: '#96dce2', starB: '#c5e7b1',
      farMtn: '#294366', farShade: '#1e324d', midHill: '#245c59', midShade: '#1b4543',
      roadTop: '#b08cd9', roadMid: '#8460b0', roadDeep: '#223547', pebble: '#5b3c85', craterPit: '#0a161d',
    },
  },
  // Stage 5 (U–Z): Omega Citadel — royal lavender-rose sky, amethyst peaks, citadel obelisks & arches
  {
    light: {
      sky: '#f5eafa', skyBand: '#ead8f5', starA: '#e03e65', starB: '#f5cc66',
      farMtn: '#cdb4eb', farShade: '#b294d9', midHill: '#b8e6d4', midShade: '#93cfb8',
      roadTop: '#ff9eb5', roadMid: '#e07993', roadDeep: '#cbbce6', pebble: '#b54e69', craterPit: '#ecdff5',
    },
    dark: {
      sky: '#190f29', skyBand: '#26173d', starA: '#ff7b9c', starB: '#f7d274',
      farMtn: '#47286e', farShade: '#341c54', midHill: '#285954', midShade: '#1d423e',
      roadTop: '#e87696', roadMid: '#b54c6b', roadDeep: '#2e1f47', pebble: '#802b46', craterPit: '#11091d',
    },
  },
];

const COMMON = {
  ink: '#34313e',
  outlineDark: '#f4efe2',
  paper: '#fffdf4',
  moon: '#fffdf4',
  moonCrater: '#ded4f1',
  pink: '#ed9eb7',
  peach: '#ffb7a5',
  lavender: '#ded4f1',
  purple: '#8a6fb3',
  aqua: '#70d6ff',
  aquaSoft: '#96dce2',
  mint: '#c5e7b1',
  cityGreen: '#5ec788',
  cityDark: '#399660',
  leaf: '#4ea870',
  ruby: '#d62454',
  gold: '#f5cc66',
  hudLight: '#fffdf4',
  hudDark: '#2a253b',
};

const GLYPHS = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  '!': ['010', '010', '010', '000', '010'],
  '<': ['001', '010', '100', '010', '001'],
  '>': ['100', '010', '001', '010', '100'],
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

const MONA_PILOT_A = [
  '.....kkk........kkk....',
  '.....kkkk......kkkk....',
  '.....kkkkkkkkkkkkkk....',
  '....kkkkkkkkkkkkkkkk...',
  '....kkiiiiiiiiiiiikk...',
  '...kkiiiiiiiiiiiiiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkicciiikkiiiccikk..',
  '....kkiiiiiiiiiiiikk...',
  '.kk..kkkkkkkkkkkkkk....',
  'kkkk...kkkkkkkkkkkqq...',
  '.kkk....kkkkkkkkkqqq...',
];

const MONA_PILOT_B = [
  '.....kkk........kkk....',
  '.....kkkk......kkkk....',
  '.....kkkkkkkkkkkkkk....',
  '....kkkkkkkkkkkkkkkk...',
  '....kkiiiiiiiiiiiikk...',
  '...kkiiiiiiiiiiiiiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkiikkiiiiiikkiikk..',
  '...kkicciiikkiiiccikk..',
  '.kk.kkiiiiiiiiiiiikk...',
  'kkkk.kkkkkkkkkkkkkk....',
  '.kkk...kkkkkkkkkkkqq...',
  '........kkkkkkkkkqqq...',
];

// UFO Type 1: `bug-dropper` — Aqua Tri-Orb Cluster Saucer (inspired by classic tri-pod squadrons)
const BUG_UFO_A = [
  '.......kkkkkk.......',
  '......kqqiiqqk......',
  '......kqqqqqqk......',
  '.......kkkkkk.......',
  '..kkkkkk..kkkkkkkk..',
  '.kqqiiqqkkqqiiqqqk..',
  '.kqqqqqqkkqqqqqqqk..',
  '..kkkkkk..kkkkkkkk..',
  '....kk........kk....',
  '...kk..........kk...',
];

const BUG_UFO_B = [
  '.......kkkkkk.......',
  '......kqqqqqqk......',
  '......kqqiiqqk......',
  '.......kkkkkk.......',
  '..kkkkkk..kkkkkkkk..',
  '.kqqqqqqkkqqqqqqqk..',
  '.kqqiiqqkkqqiiqqqk..',
  '..kkkkkk..kkkkkkkk..',
  '.....kk......kk.....',
  '......kk....kk......',
];

// UFO Type 2: `cve-bomber` — Crimson & Gold Horned Heavy Warhead Saucer
const CVE_UFO_A = [
  '..kk............kk..',
  '...kk..kkkkkk..kk...',
  '....kkggggggggkk....',
  '..kkkggiiiggiiggkkk.',
  '.kkkkkkkkkkkkkkkkkk.',
  'krrrrrrrrrrrrrrrrrrk',
  'krriirrrgggggrriirrk',
  '.kkkkkkkkkkkkkkkkkk.',
  '......kkkkkkkk......',
  '.......krrrrk.......',
];

const CVE_UFO_B = [
  '..kk............kk..',
  '...kk..kkkkkk..kk...',
  '....kkggggggggkk....',
  '..kkkggiigggiiggkkk.',
  '.kkkkkkkkkkkkkkkkkk.',
  'krrrrrrrrrrrrrrrrrrk',
  'krrgggggrriirrrgggkr',
  '.kkkkkkkkkkkkkkkkkk.',
  '......kkkkkkkk......',
  '.......kggggk.......',
];

// Dropped "Bug" (explodes on contact, flapping pixel wings)
const BUG_DROP_A = [
  'kk....kk',
  '.kkkkkk.',
  'kkpiiipk',
  '.kppppk.',
  'kk.kk.kk',
];

const BUG_DROP_B = [
  '.kk..kk.',
  'kkkkkkkk',
  '.kpiipk.',
  'kkppppkk',
  '.k....k.',
];

// Dropped "CVE" warhead (creates a crater on road impact!)
const CVE_DROP = [
  '.kkkkkk.',
  '.kggggk.',
  'kkrggkrk',
  'kkriirkk',
  '.krrrrk.',
  '..kkkk..',
  '...kk...',
];

const ROCK_SMALL_MAP = [
  '....kkkkk....',
  '..kkllllllk..',
  '.klliiillllk.',
  'klliilllllllk',
  'kllllllllsssk',
  'klllllllssssk',
  'kllllllsssssk',
  'klllllssssssk',
  'kllllsssssssk',
  '.ksssssssssk.',
  '..kkkkkkkkk..',
];

const ROCK_TALL_MAP = [
  '.....kkkkkk.....',
  '...kkllllllkk...',
  '..klliiilllllk..',
  '.klliillllllllk.',
  '.klllllllllsssk.',
  'kllllllllllssssk',
  'klllkkllllsssssk',
  'kllliillllsssssk',
  'kllllllllssssssk',
  'klllllllsssssssk',
  'kllllllssssssssk',
  'kllllllssssssssk',
  'klllllsssssssssk',
  '.klllsssssssssk.',
  '.kssssssssssssk.',
  '..kkkkkkkkkkkk..',
];

// 2-frame rotating 12x12 (@ 2px = 24x24) rolling highland stone
const ROLLING_STONE_A = [
  '...kkkkkk...',
  '.kkggggggkk.',
  'kggiiggggggk',
  'kggiiggggssk',
  'kggggkkggssk',
  'kgggkkkksssk',
  'kggggkkssssk',
  'kgggggsssssk',
  'kggggssssssk',
  'kgggsssssssk',
  '.kksssssskk.',
  '...kkkkkk...',
];

const ROLLING_STONE_B = [
  '...kkkkkk...',
  '.kkggggggkk.',
  'kggggggiigk.',
  'kggggggiigsk',
  'kggkkggggssk',
  'ksskkkkggssk',
  'kssskkggsssk',
  'kssssggssssk',
  'kssssssssssk',
  'kgggsssssssk',
  '.kksssssskk.',
  '...kkkkkk...',
];

const WHEEL_A = [
  '.kkkkk.',
  'kkkkkkk',
  'kkkikkk',
  'kkiikkk',
  'kkkikkk',
  'kkkkkkk',
  '.kkkkk.',
];

const WHEEL_B = [
  '.kkkkk.',
  'kkkkkkk',
  'kkikikk',
  'kkk.kkk',
  'kkikikk',
  'kkkkkkk',
  '.kkkkk.',
];

function pxRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), snap(w), snap(h));
}

function pxFrame(ctx, x, y, w, h, fill, border = COMMON.ink) {
  pxRect(ctx, x, y, w, h, border);
  pxRect(ctx, x + PX, y + PX, w - PX * 2, h - PX * 2, fill);
}

function drawBitmapText(ctx, text, x, y, scale = 2, color = COMMON.ink) {
  let cursor = snap(x);
  const top = snap(y);
  for (const ch of String(text).toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let gy = 0; gy < g.length; gy++) {
      const row = g[gy];
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] === '1') {
          ctx.fillStyle = color;
          ctx.fillRect(cursor + gx * scale, top + gy * scale, scale, scale);
        }
      }
    }
    cursor += scale * 4;
  }
}

function drawSprite(ctx, map, x, y, colors, pixelSize = PX) {
  const ox = snap(x);
  const oy = snap(y);
  for (let r = 0; r < map.length; r++) {
    const line = map[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '.' || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(ox + c * pixelSize, oy + r * pixelSize, pixelSize, pixelSize);
    }
  }
}

function farMtnHeight(wx, sectorIdx) {
  const col = Math.floor(wx / 8);
  if (sectorIdx === 3) {
    // Flat-topped canyon mesas in Stage 4
    const raw = 186 + Math.sin(col * 0.08) * 28;
    return Math.round(raw / 14) * 14;
  }
  const h = 184 + Math.sin(col * 0.09 + sectorIdx) * 32 + Math.cos(col * 0.23) * 16;
  return Math.round(h / 6) * 6;
}

function midHillHeight(wx, sectorIdx) {
  const col = Math.floor(wx / 8);
  const h = 234 + Math.sin(col * 0.14 + 1.4 + sectorIdx * 0.8) * 16 + Math.cos(col * 0.31) * 6;
  return Math.round(h / 4) * 4;
}

// Stage-specific midground architecture & scenery!
function drawStageScenery(ctx, sectorIdx, midScroll, border, stagePal) {
  if (sectorIdx === 0) {
    // Stage 1 (A–E): Small lunar REPO domes & antennae
    const period = 256;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = snap(dx - midScroll);
      const baseY = midHillHeight(dx, sectorIdx);
      pxRect(ctx, sx + 12, baseY - 26, PX, 12, border);
      pxRect(ctx, sx + 10, baseY - 30, 6, 6, COMMON.pink);
      pxFrame(ctx, sx, baseY - 16, 28, 16, COMMON.paper, border);
      pxFrame(ctx, sx + 4, baseY - 20, 20, 6, COMMON.aquaSoft, border);
      pxRect(ctx, sx + 10, baseY - 10, 8, 8, COMMON.ink);
    }
    return;
  }

  if (sectorIdx === 1) {
    // Stage 2 (F–J): Octo Metropolis — Futuristic bulbous green/gold city towers with
    // lit window slits & V-antennae (homage to classic Point F–J alien skyline!)
    const period = 152;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const variant = Math.abs(Math.floor(dx / period)) % 3;
      const sx = snap(dx - midScroll);
      const baseY = GROUND_Y - 8;

      if (variant === 0) {
        // Tall tiered bulbous spire with sunlit gold right highlight
        pxFrame(ctx, sx + 8, baseY - 76, 36, 76, COMMON.cityGreen, border);
        pxRect(ctx, sx + 34, baseY - 74, 8, 72, COMMON.gold);
        pxFrame(ctx, sx, baseY - 56, 52, 22, COMMON.cityGreen, border);
        pxRect(ctx, sx + 40, baseY - 54, 10, 18, COMMON.gold);
        // Twin rooftop spires
        pxRect(ctx, sx + 18, baseY - 90, PX, 14, border);
        pxRect(ctx, sx + 32, baseY - 86, PX, 10, border);
        // Lit pixel window rows
        for (let wx = sx + 6; wx < sx + 40; wx += 8) {
          pxRect(ctx, wx, baseY - 48, 4, 4, COMMON.ink);
        }
        for (let wy = baseY - 68; wy < baseY - 16; wy += 14) {
          pxRect(ctx, sx + 14, wy, 14, 4, COMMON.ink);
        }
      } else if (variant === 1) {
        // Wide mushroom saucer tower with V-antenna
        pxFrame(ctx, sx + 14, baseY - 52, 28, 52, COMMON.cityGreen, border);
        pxRect(ctx, sx + 32, baseY - 50, 8, 48, COMMON.gold);
        pxFrame(ctx, sx - 2, baseY - 68, 60, 20, COMMON.cityGreen, border);
        pxRect(ctx, sx + 44, baseY - 66, 12, 16, COMMON.gold);
        // V-antenna
        pxRect(ctx, sx + 22, baseY - 78, 4, 10, border);
        pxRect(ctx, sx + 32, baseY - 78, 4, 10, border);
        for (let wx = sx + 6; wx < sx + 46; wx += 8) {
          pxRect(ctx, wx, baseY - 60, 4, 4, COMMON.ink);
        }
      } else {
        // Twin connected bio-domes
        pxFrame(ctx, sx + 4, baseY - 62, 28, 62, COMMON.cityDark, border);
        pxFrame(ctx, sx + 26, baseY - 46, 26, 46, COMMON.cityGreen, border);
        pxRect(ctx, sx + 42, baseY - 44, 8, 42, COMMON.gold);
        pxRect(ctx, sx + 16, baseY - 74, PX, 12, border);
        pxRect(ctx, sx + 10, baseY - 52, 12, 4, COMMON.gold);
        pxRect(ctx, sx + 10, baseY - 38, 12, 4, COMMON.gold);
      }
    }
    return;
  }

  if (sectorIdx === 2) {
    // Stage 3 (K–O): Canary Minefield — Industrial radar dishes & warning gantries
    const period = 196;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = snap(dx - midScroll);
      const baseY = midHillHeight(dx, sectorIdx);
      // Lattice tower legs
      pxRect(ctx, sx + 8, baseY - 44, 4, 44, border);
      pxRect(ctx, sx + 24, baseY - 44, 4, 44, border);
      pxRect(ctx, sx + 8, baseY - 26, 20, 4, border);
      // Stepped parabolic dish
      pxFrame(ctx, sx, baseY - 58, 36, 14, COMMON.lavender, border);
      pxRect(ctx, sx + 16, baseY - 68, 4, 10, border);
      pxRect(ctx, sx + 14, baseY - 72, 8, 6, COMMON.ruby);
    }
    return;
  }

  if (sectorIdx === 3) {
    // Stage 4 (P–T): Rolling Highlands — Suspension bridge pylons & beacon towers
    const period = 220;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = snap(dx - midScroll);
      const baseY = midHillHeight(dx, sectorIdx);
      pxFrame(ctx, sx + 6, baseY - 64, 16, 64, stagePal.farMtn, border);
      pxFrame(ctx, sx, baseY - 52, 28, 8, COMMON.gold, border);
      pxFrame(ctx, sx + 2, baseY - 72, 24, 10, COMMON.aquaSoft, border);
    }
    return;
  }

  // Stage 5 (U–Z): Omega Citadel — Grand obelisks, energy arches & crystal spires
  const period = 176;
  const first = Math.floor(midScroll / period) * period;
  for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
    const sx = snap(dx - midScroll);
    const baseY = GROUND_Y - 6;
    pxFrame(ctx, sx + 4, baseY - 74, 16, 74, COMMON.purple, border);
    pxFrame(ctx, sx + 36, baseY - 74, 16, 74, COMMON.purple, border);
    pxFrame(ctx, sx, baseY - 86, 56, 16, COMMON.lavender, border);
    pxRect(ctx, sx + 24, baseY - 98, 8, 12, COMMON.gold);
    pxRect(ctx, sx + 12, baseY - 80, 32, 4, COMMON.ruby);
  }
}

function drawSkyAndParallax(ctx, state, stagePal, reducedMotion, dark) {
  const border = dark ? COMMON.outlineDark : COMMON.ink;
  const sectorIdx = state.sectorIndex ?? 0;

  pxRect(ctx, 0, 0, WORLD_WIDTH, GROUND_Y, stagePal.sky);
  pxRect(ctx, 0, 0, WORLD_WIDTH, 54, stagePal.skyBand);

  // Stars
  const starOffset = reducedMotion ? 0 : Math.floor((state.cameraX * 0.05) / PX) * PX;
  const starCoords = [
    [52, 24], [138, 42], [224, 20], [318, 46], [412, 26], [578, 36], [96, 78], [276, 72], [458, 68],
  ];
  for (const [idx, [sx, sy]] of starCoords.entries()) {
    const px = (((sx - starOffset) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const blink = !reducedMotion && Math.floor(state.elapsed * 3 + idx) % 5 === 0;
    const col = idx % 2 === 0 ? stagePal.starA : stagePal.starB;
    if (blink) {
      pxRect(ctx, px - 4, sy, 10, 2, col);
      pxRect(ctx, px, sy - 4, 2, 10, col);
    } else {
      pxRect(ctx, px, sy, 4, 4, col);
    }
  }

  // Lunar / Ringed planet in upper right (varies subtly by stage!)
  const moonX = 516;
  const moonY = 30;
  const spans = [12, 20, 26, 30, 32, 34, 34, 34, 32, 30, 26, 20, 12];
  spans.forEach((w, row) => {
    pxRect(ctx, moonX - w / 2 - 2, moonY + row * 3, w + 4, 4, border);
  });
  spans.forEach((w, row) => {
    if (row > 0 && row < spans.length - 1) {
      pxRect(
        ctx,
        moonX - w / 2,
        moonY + row * 3,
        w,
        4,
        sectorIdx % 2 === 1 ? COMMON.gold : COMMON.moon,
      );
    }
  });
  if (sectorIdx >= 2) {
    // Pixel planetary ring in Stages 3–5!
    pxRect(ctx, moonX - 28, moonY + 18, 56, 4, COMMON.pink);
  } else {
    pxRect(ctx, moonX - 8, moonY + 12, 6, 6, COMMON.moonCrater);
    pxRect(ctx, moonX + 4, moonY + 22, 8, 6, COMMON.moonCrater);
  }

  // Far stepped mountain range
  const farScroll = reducedMotion ? 0 : Math.floor((state.cameraX * 0.16) / 8) * 8;
  for (let sx = 0; sx < WORLD_WIDTH; sx += 8) {
    const wx = sx + farScroll;
    const h = farMtnHeight(wx, sectorIdx);
    const nextH = farMtnHeight(wx + 8, sectorIdx);
    pxRect(ctx, sx, h, 8, GROUND_Y - h, nextH > h ? stagePal.farShade : stagePal.farMtn);
    pxRect(ctx, sx, h, 8, PX, border);
    if (nextH !== h) {
      pxRect(ctx, sx + 6, Math.min(h, nextH), PX, Math.abs(nextH - h) + PX, border);
    }
  }

  // Mid stepped hills
  const midScroll = reducedMotion ? 0 : Math.floor((state.cameraX * 0.36) / 8) * 8;
  for (let sx = 0; sx < WORLD_WIDTH; sx += 8) {
    const wx = sx + midScroll;
    const h = midHillHeight(wx, sectorIdx);
    const nextH = midHillHeight(wx + 8, sectorIdx);
    pxRect(ctx, sx, h, 8, GROUND_Y - h, nextH > h ? stagePal.midShade : stagePal.midHill);
    pxRect(ctx, sx, h, 8, PX, border);
    if (nextH !== h) {
      pxRect(ctx, sx + 6, Math.min(h, nextH), PX, Math.abs(nextH - h) + PX, border);
    }
  }

  // Stage-specific buildings & structures!
  drawStageScenery(ctx, sectorIdx, midScroll, border, stagePal);
}

function drawPixelRoadAndCraters(ctx, state, stagePal, reducedMotion, dark) {
  const camX = snap(state.cameraX);
  const border = dark ? COMMON.outlineDark : COMMON.ink;
  const sectorIdx = state.sectorIndex ?? 0;

  const craters = state.course.obstacles.filter(
    (o) =>
      o.kind.startsWith('crater') &&
      o.x + o.width >= camX - 32 &&
      o.x <= camX + WORLD_WIDTH + 32,
  );

  for (let sx = 0; sx < WORLD_WIDTH; sx += 4) {
    const wx = camX + sx;
    const crater = craters.find((c) => wx >= c.x && wx < c.x + c.width);
    if (crater) {
      const rel = (wx - crater.x) / crater.width;
      const stepDepth = rel < 0.2 || rel > 0.8 ? 14 : rel < 0.38 || rel > 0.62 ? 26 : 36;
      const pitY = GROUND_Y + stepDepth;
      pxRect(ctx, sx, GROUND_Y, 4, stepDepth, stagePal.craterPit);
      pxRect(ctx, sx, pitY, 4, WORLD_HEIGHT - pitY, stagePal.roadDeep);
      pxRect(ctx, sx, pitY, 4, PX * 2, border);
    } else {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates, sectorIdx);
      pxRect(ctx, sx, gy, 4, 16, stagePal.roadTop);
      pxRect(ctx, sx, gy + 16, 4, 18, stagePal.roadMid);
      pxRect(ctx, sx, gy + 34, 4, WORLD_HEIGHT - (gy + 34), stagePal.roadDeep);
      pxRect(ctx, sx, gy, 4, PX * 2, border);
    }
  }

  for (const crater of craters) {
    const lx = snap(crater.x - camX);
    const rx = snap(crater.x + crater.width - camX);
    pxRect(ctx, lx - PX, GROUND_Y, PX * 2, 18, border);
    pxRect(ctx, rx - PX, GROUND_Y, PX * 2, 18, border);

    const rimColor = crater.fromCve ? COMMON.ruby : COMMON.gold;
    pxFrame(ctx, lx - 8, GROUND_Y - 10, 8, 10, rimColor, border);
    pxFrame(ctx, rx, GROUND_Y - 10, 8, 10, rimColor, border);

    drawBitmapText(
      ctx,
      crater.fromCve ? 'CVE' : '<<<',
      (lx + rx) * 0.5 - 16,
      GROUND_Y + 14,
      2,
      COMMON.ruby,
    );
  }

  const pebbleShift = reducedMotion ? 0 : Math.floor(camX / PX) * PX;
  for (let px = -(pebbleShift % 48); px < WORLD_WIDTH; px += 48) {
    const wx = camX + px;
    const inCrater = craters.some((c) => wx >= c.x - 8 && wx <= c.x + c.width + 8);
    if (!inCrater) {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates, sectorIdx);
      pxRect(ctx, px, gy + 8, 6, 4, stagePal.pebble);
      pxRect(ctx, px + 22, gy + 20, 8, 4, stagePal.pebble);
    }
  }
}

function drawPixelGatesAndObstacles(ctx, state, reducedMotion, dark) {
  const camX = snap(state.cameraX);
  const border = dark ? COMMON.outlineDark : COMMON.ink;
  const sectorIdx = state.sectorIndex ?? 0;

  for (const gate of state.course.gates) {
    const sx = snap(gate.x - camX);
    if (sx < -80 || sx > WORLD_WIDTH + 80) continue;
    const gy = groundYAt(gate.x, state.course.obstacles, state.course.gates, sectorIdx);

    if (gate.isMajor) {
      pxRect(ctx, sx - 6, gy - 84, 6, 84, border);
      pxRect(ctx, sx + 54, gy - 84, 6, 84, border);
      pxFrame(ctx, sx - 12, gy - 106, 78, 26, gate.reached ? COMMON.mint : COMMON.pink, border);
      for (let c = 0; c < 12; c++) {
        pxRect(ctx, sx - 10 + c * 6, gy - 104, 6, 4, c % 2 === 0 ? COMMON.ink : COMMON.paper);
      }
      drawBitmapText(ctx, `GOAL ${gate.letter}`, sx + 4, gy - 94, 2, COMMON.ink);
    } else {
      pxRect(ctx, sx, gy - 62, 4, 62, border);
      pxFrame(ctx, sx + 4, gy - 62, 34, 24, gate.reached ? COMMON.mint : COMMON.lavender, border);
      drawBitmapText(ctx, gate.reached ? `${gate.letter}+` : gate.letter, sx + 13, gy - 55, 2, COMMON.ink);
    }
  }

  const rockColors = {
    k: COMMON.ink,
    l: COMMON.lavender,
    i: COMMON.paper,
    s: COMMON.purple,
  };

  const blink = !reducedMotion && Math.floor(state.elapsed * 8) % 2 === 0;

  for (const obs of state.course.obstacles) {
    if (obs.destroyed || obs.kind.startsWith('crater')) continue;
    const sx = snap(obs.x - camX);
    if (sx + obs.width < -32 || sx > WORLD_WIDTH + 32) continue;
    const gy = groundYAt(
      obs.x + obs.width * 0.5,
      state.course.obstacles,
      state.course.gates,
      sectorIdx,
    );

    if (obs.kind === 'mine') {
      // Unmistakable armored 8-bit landmine with 3 red contact prongs & blinking beacon
      pxFrame(ctx, sx, gy - 10, 20, 10, '#625d73', border);
      pxRect(ctx, sx + 2, gy - 14, 4, 4, COMMON.ruby);
      pxRect(ctx, sx + 8, gy - 16, 4, 6, COMMON.ruby);
      pxRect(ctx, sx + 14, gy - 14, 4, 4, COMMON.ruby);
      pxRect(ctx, sx + 8, gy - 6, 4, 4, blink ? COMMON.gold : COMMON.ruby);
      continue;
    }

    if (obs.kind === 'rock-tall') {
      drawSprite(ctx, ROCK_TALL_MAP, sx, gy - 32, rockColors, PX);
      if (obs.hp < obs.maxHp) {
        pxRect(ctx, sx + 14, gy - 28, 4, 8, COMMON.ruby);
        pxRect(ctx, sx + 10, gy - 20, 4, 8, COMMON.ruby);
        pxRect(ctx, sx + 14, gy - 12, 4, 8, COMMON.ruby);
      }
    } else {
      drawSprite(ctx, ROCK_SMALL_MAP, sx, gy - 22, rockColors, PX);
    }
  }

  // Rolling & bouncing highland stones (Stages 4 & 5)
  for (const stone of state.rollingStones ?? []) {
    const sx = snap(stone.x - camX - 12);
    const sy = snap(stone.y - 24);
    const spin = reducedMotion ? 0 : Math.floor(stone.phase) % 2;
    drawSprite(
      ctx,
      spin === 0 ? ROLLING_STONE_A : ROLLING_STONE_B,
      sx,
      sy,
      {
        k: COMMON.ink,
        g: stone.hp < stone.maxHp ? COMMON.peach : COMMON.gold,
        i: COMMON.paper,
        s: '#b57b2e',
      },
      PX,
    );
  }
}

function drawRoverAndMona(ctx, state, reducedMotion) {
  if (state.invulnTimer > 0 && Math.floor(state.invulnTimer * 12) % 2 === 1) {
    return;
  }

  const bx = snap(state.buggy.screenX);
  const bodyLift = !state.buggy.grounded ? -2 : 0;
  const by = snap(state.buggy.y);
  const animFrame = reducedMotion ? 0 : Math.floor(state.buggy.wheelPhase * 0.6) % 2;

  if (state.gearIndex === 2 && state.status === 'playing') {
    const flameLen = animFrame === 0 ? 14 : 10;
    pxRect(ctx, bx - 34 - flameLen, by - 20 + bodyLift, flameLen, 8, COMMON.gold);
    pxRect(ctx, bx - 30 - flameLen / 2, by - 18 + bodyLift, flameLen / 2, 4, COMMON.ruby);
  }

  drawSprite(
    ctx,
    animFrame === 0 ? MONA_PILOT_A : MONA_PILOT_B,
    bx - 22,
    by - 50 + bodyLift,
    {
      k: COMMON.ink,
      i: COMMON.paper,
      c: COMMON.peach,
      q: COMMON.aquaSoft,
    },
    PX,
  );

  pxFrame(ctx, bx - 30, by - 30 + bodyLift, 10, 10, COMMON.aquaSoft, COMMON.ink);
  pxRect(ctx, bx - 27, by - 34 + bodyLift, 4, 4, COMMON.leaf);

  pxFrame(ctx, bx - 34, by - 22 + bodyLift, 68, 12, COMMON.pink, COMMON.ink);
  pxRect(ctx, bx - 30, by - 20 + bodyLift, 58, 2, COMMON.peach);
  pxRect(ctx, bx - 18, by - 16 + bodyLift, 36, 4, COMMON.lavender);

  pxFrame(ctx, bx + 32, by - 20 + bodyLift, 8, 8, COMMON.gold, COMMON.ink);
  pxRect(ctx, bx + 40, by - 18 + bodyLift, 4, 4, COMMON.ruby);

  const wheelMap = animFrame === 0 ? WHEEL_A : WHEEL_B;
  const wheelColors = { k: COMMON.ink, i: COMMON.paper };
  for (const [idx, wxOff] of [-22, 0, 22].entries()) {
    const bounce =
      reducedMotion || !state.buggy.grounded
        ? 0
        : Math.round(Math.sin(state.buggy.wheelPhase + idx * 1.8)) * PX;
    const wy = by - 14 + bounce;
    pxRect(ctx, bx + wxOff - 2, by - 12 + bodyLift, 4, 6, COMMON.ink);
    drawSprite(ctx, wheelMap, bx + wxOff - 7, wy, wheelColors, PX);
  }
}

function drawAerialAndProjectiles(ctx, state, reducedMotion) {
  const camX = snap(state.cameraX);

  for (const shot of state.shots) {
    const sx = snap(shot.x - camX);
    const sy = snap(shot.y);
    if (shot.kind === 'forward') {
      pxFrame(ctx, sx - 10, sy - 4, 20, 8, COMMON.ruby, COMMON.ink);
      pxRect(ctx, sx - 6, sy - 2, 12, 2, COMMON.paper);
    } else {
      pxFrame(ctx, sx - 4, sy - 10, 8, 18, COMMON.aqua, COMMON.ink);
      pxRect(ctx, sx - 2, sy - 6, 4, 10, COMMON.paper);
    }
  }

  // Render distinct Bug-Dropper Tri-Pods vs Armored CVE Crater-Bombers!
  const ufoFrame = reducedMotion ? 0 : Math.floor(state.elapsed * 6) % 2;
  for (const ufo of state.ufos) {
    const ux = snap(ufo.screenX - 20);
    const uy = snap(ufo.y - 10);
    const isCve = ufo.kind === 'cve-bomber' || ufo.kind === 'bomber';
    if (isCve) {
      drawSprite(
        ctx,
        ufoFrame === 0 ? CVE_UFO_A : CVE_UFO_B,
        ux,
        uy,
        {
          k: COMMON.ink,
          r: COMMON.ruby,
          g: COMMON.gold,
          i: COMMON.paper,
        },
        PX,
      );
    } else {
      drawSprite(
        ctx,
        ufoFrame === 0 ? BUG_UFO_A : BUG_UFO_B,
        ux,
        uy,
        {
          k: COMMON.ink,
          q: COMMON.aqua,
          i: COMMON.paper,
        },
        PX,
      );
    }
  }

  // Render fluttering Bugs vs heavy crater-carving CVE warheads!
  const dropFrame = reducedMotion ? 0 : Math.floor(state.elapsed * 10) % 2;
  for (const bomb of state.bombs) {
    const sx = snap(bomb.x - camX);
    const sy = snap(bomb.y);
    const isCve = bomb.kind === 'cve' || Boolean(bomb.carvesCrater);
    if (isCve) {
      drawSprite(
        ctx,
        CVE_DROP,
        sx - 8,
        sy - 8,
        {
          k: COMMON.ink,
          r: dropFrame === 0 ? COMMON.ruby : COMMON.gold,
          g: COMMON.gold,
          i: COMMON.paper,
        },
        PX,
      );
      drawBitmapText(ctx, 'CVE', sx + 10, sy - 4, 1, COMMON.ruby);
    } else {
      drawSprite(
        ctx,
        dropFrame === 0 ? BUG_DROP_A : BUG_DROP_B,
        sx - 8,
        sy - 6,
        {
          k: COMMON.ink,
          p: COMMON.pink,
          i: COMMON.paper,
        },
        PX,
      );
    }
  }

  for (const p of state.particles) {
    const sx = snap(p.x - camX);
    const sy = snap(p.y);
    const size = p.life > p.maxLife * 0.5 ? 8 : 6;
    const fill =
      p.colorKind === 'ruby'
        ? COMMON.ruby
        : p.colorKind === 'lavender'
          ? COMMON.lavender
          : p.colorKind === 'mint'
            ? COMMON.aqua
            : COMMON.gold;
    pxFrame(ctx, sx - size / 2, sy - size / 2, size, size, fill, COMMON.ink);
  }
}

function drawPixelHudBezel(ctx, state, stagePal, dark) {
  const border = dark ? COMMON.outlineDark : COMMON.ink;
  const hudBg = dark ? COMMON.hudDark : COMMON.hudLight;
  const textCol = dark ? COMMON.paper : COMMON.ink;

  if (state.ufos.length > 0) {
    const hasCve = state.ufos.some((u) => u.kind === 'cve-bomber' || u.kind === 'bomber');
    pxFrame(ctx, 12, 10, 168, 22, hasCve ? COMMON.gold : COMMON.pink, border);
    drawBitmapText(
      ctx,
      hasCve ? `CVE+BUGS ${state.ufos.length}` : `BUG UFO ${state.ufos.length}`,
      20,
      16,
      2,
      COMMON.ink,
    );
  }

  const gear = GEARS[state.gearIndex];
  pxFrame(ctx, WORLD_WIDTH - 134, 10, 122, 22, hudBg, border);
  for (let g = 0; g < 3; g++) {
    pxFrame(
      ctx,
      WORLD_WIDTH - 126 + g * 12,
      15,
      10,
      12,
      g <= state.gearIndex ? COMMON.mint : stagePal.skyBand,
      border,
    );
  }
  drawBitmapText(ctx, gear.label, WORLD_WIDTH - 84, 16, 2, textCol);

  const barX = 20;
  const barY = 328;
  const barW = WORLD_WIDTH - 40;
  pxFrame(ctx, barX, barY, barW, 24, hudBg, border);

  drawBitmapText(ctx, state.course.sectorName, barX + 10, barY + 7, 2, textCol);

  const letters = sectorCheckpointLetters(state.checkpointIndex);
  const trackLeft = barX + 86;
  const trackRight = barX + barW - 22;
  const trackW = trackRight - trackLeft;
  const ratio = Math.max(0, Math.min(1, state.buggy.worldX / Math.max(1, state.course.length)));

  pxRect(ctx, trackLeft, barY + 11, trackW, 4, border);
  pxRect(ctx, trackLeft, barY + 11, trackW * ratio, 4, COMMON.leaf);

  letters.forEach((letter, idx) => {
    const lx = snap(trackLeft + (trackW * idx) / Math.max(1, letters.length - 1));
    const reached = state.course.gates[idx]?.reached;
    pxFrame(ctx, lx - 8, barY + 4, 16, 16, reached ? COMMON.mint : COMMON.paper, border);
    drawBitmapText(ctx, letter, lx - 3, barY + 7, 2, COMMON.ink);
  });

  const markerX = snap(trackLeft + trackW * ratio);
  pxRect(ctx, markerX - 4, barY - 2, 8, 6, COMMON.ruby);
}

export function renderGame(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dark = options.theme === 'dark';
  const reducedMotion = Boolean(options.reducedMotion);
  const sectorIdx = Math.max(0, Math.min(STAGE_THEMES.length - 1, state.sectorIndex ?? 0));
  const stagePal = dark ? STAGE_THEMES[sectorIdx].dark : STAGE_THEMES[sectorIdx].light;

  if (canvas.width !== WORLD_WIDTH || canvas.height !== WORLD_HEIGHT) {
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
  }
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  if (state.status === 'crashing' && !reducedMotion) {
    const shake = Math.round(Math.sin(state.crashTimer * 50) * 2) * PX;
    ctx.translate(shake, 0);
  }

  drawSkyAndParallax(ctx, state, stagePal, reducedMotion, dark);
  drawPixelRoadAndCraters(ctx, state, stagePal, reducedMotion, dark);
  drawPixelGatesAndObstacles(ctx, state, reducedMotion, dark);
  if (state.status !== 'crashing' || state.crashTimer > 0.35) {
    drawRoverAndMona(ctx, state, reducedMotion);
  }
  drawAerialAndProjectiles(ctx, state, reducedMotion);
  drawPixelHudBezel(ctx, state, stagePal, dark);

  ctx.restore();
}
