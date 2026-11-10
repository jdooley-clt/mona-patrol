// True 8-bit stepped pixel-art 2D Canvas renderer for Mona Patrol.
// Built on a strict 2px integer pixel grid (`imageSmoothingEnabled = false`) using the
// Commit Cabinet's candy-arcade palette, bitmap pixel font, and canonical pixel Mona.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GROUND_Y,
  GEARS,
  groundYAt,
  sectorCheckpointLetters,
} from './engine.js';

const PX = 2; // 1 arcade pixel = 2x2 canvas pixels (320x180 true 8-bit raster feel on 640x360)
const snap = (v) => Math.round(v / PX) * PX;

export const PALETTES = {
  light: {
    sky: '#fff7df',
    skyBand: '#f7efd4',
    starA: '#ded4f1',
    starB: '#ffb7a5',
    moon: '#fffdf4',
    moonCrater: '#ded4f1',
    farMtn: '#ded4f1',
    farShade: '#c3b2e3',
    midHill: '#c5e7b1',
    midShade: '#9ed097',
    dome: '#fffdf4',
    domeRoof: '#96dce2',
    roadTop: '#ffb7a5',
    roadMid: '#e89592',
    roadDeep: '#d8cde9',
    pebble: '#c97879',
    craterPit: '#f3e8cc',
    ink: '#34313e',
    paper: '#fffdf4',
    pink: '#ed9eb7',
    peach: '#ffb7a5',
    lavender: '#ded4f1',
    purple: '#8a6fb3',
    aqua: '#96dce2',
    mint: '#c5e7b1',
    leaf: '#568773',
    ruby: '#b11f4b',
    gold: '#f5cc66',
    hudBg: '#fffdf4',
  },
  dark: {
    sky: '#1b1826',
    skyBand: '#231f31',
    starA: '#fffdf4',
    starB: '#96dce2',
    moon: '#fff7df',
    moonCrater: '#d5c6ef',
    farMtn: '#3f3459',
    farShade: '#312847',
    midHill: '#2d574b',
    midShade: '#23453b',
    dome: '#ded4f1',
    domeRoof: '#96dce2',
    roadTop: '#e89592',
    roadMid: '#b56974',
    roadDeep: '#3a3250',
    pebble: '#7d4454',
    craterPit: '#14111d',
    ink: '#34313e',
    outlineLight: '#f4efe2',
    paper: '#fffdf4',
    pink: '#ed9eb7',
    peach: '#ffb7a5',
    lavender: '#ded4f1',
    purple: '#8a6fb3',
    aqua: '#96dce2',
    mint: '#c5e7b1',
    leaf: '#67c98c',
    ruby: '#ff6e91',
    gold: '#f7d274',
    hudBg: '#2c283c',
  },
};

// Crisp 3x5 / 4x5 8-bit bitmap glyphs (no anti-aliased system fonts on canvas)
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
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

// Canonical pixel Mona seated in open cockpit (23x14 @ 2px = 46x28 px)
// Unmistakable tall Octocat ears, wide creamy face, vertical eyes, peach cheeks,
// cute mouth, waving left tentacle, and paws on the aqua steering wheel.
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

// 20x12 @ 2px (40x24 px) 8-bit Bug Saucer UFO (2 animation frames)
const UFO_SPRITE_A = [
  '....kk........kk....',
  '.....kk......kk.....',
  '......kkkkkkkk......',
  '....kkqqqqqqqqkk....',
  '...kqqiiqqqqqqqqk...',
  '.kkkkkkkkkkkkkkkkkk.',
  'kppppppppppppppppppk',
  'kppiiipppiiipppiiipk',
  '.kkkkkkkkkkkkkkkkkk.',
  '..kk..kk....kk..kk..',
  '.kk...kk....kk...kk.',
  '....................',
];

const UFO_SPRITE_B = [
  '...kk..........kk...',
  '....kk........kk....',
  '......kkkkkkkk......',
  '....kkqqqqqqqqkk....',
  '...kqqiiqqqqqqqqk...',
  '.kkkkkkkkkkkkkkkkkk.',
  'kppppppppppppppppppk',
  'kpiiipppiiipppiiippk',
  '.kkkkkkkkkkkkkkkkkk.',
  '...kk..kk..kk..kk...',
  '..kk....kkkk....kk..',
  '....................',
];

// 13x11 @ 2px (26x22 px) 8-bit small lunar boulder
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

// 16x16 @ 2px (32x32 px) 8-bit tall lunar boulder
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

// 7x7 @ 2px (14x14 px) chunky 8-bit rover wheel (2 spoke rotation frames)
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

function pxFrame(ctx, x, y, w, h, fill, border = '#34313e') {
  pxRect(ctx, x, y, w, h, border);
  pxRect(ctx, x + PX, y + PX, w - PX * 2, h - PX * 2, fill);
}

function drawBitmapText(ctx, text, x, y, scale = 2, color = '#34313e') {
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

// Stepped 8-bit mountain height (quantized to 6px vertical steps every 8px horizontally)
function farMtnHeight(wx) {
  const col = Math.floor(wx / 8);
  const h = 188 + Math.sin(col * 0.09) * 32 + Math.cos(col * 0.21) * 16;
  return Math.round(h / 6) * 6;
}

function midHillHeight(wx) {
  const col = Math.floor(wx / 8);
  const h = 232 + Math.sin(col * 0.14 + 1.4) * 18 + Math.cos(col * 0.31) * 8;
  return Math.round(h / 4) * 4;
}

function drawSkyAndParallax(ctx, state, pal, reducedMotion, dark) {
  const border = dark ? pal.outlineLight : pal.ink;

  // Stepped 8-bit sky bands
  pxRect(ctx, 0, 0, WORLD_WIDTH, GROUND_Y, pal.sky);
  pxRect(ctx, 0, 0, WORLD_WIDTH, 56, pal.skyBand);

  // Pixelated stars
  const starOffset = reducedMotion ? 0 : Math.floor((state.cameraX * 0.05) / PX) * PX;
  const starCoords = [
    [52, 26],
    [138, 44],
    [224, 22],
    [318, 48],
    [412, 28],
    [578, 38],
    [96, 82],
    [276, 76],
    [458, 72],
  ];
  for (const [idx, [sx, sy]] of starCoords.entries()) {
    const px = (((sx - starOffset) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const blink = !reducedMotion && Math.floor(state.elapsed * 3 + idx) % 5 === 0;
    const col = idx % 2 === 0 ? pal.starA : pal.starB;
    if (blink) {
      pxRect(ctx, px - 4, sy, 10, 2, col);
      pxRect(ctx, px, sy - 4, 2, 10, col);
    } else {
      pxRect(ctx, px, sy, 4, 4, col);
    }
  }

  // Pixelated lunar globe in upper-right sky
  const moonX = 508;
  const moonY = 34;
  const spans = [12, 20, 26, 30, 32, 34, 34, 34, 32, 30, 26, 20, 12];
  spans.forEach((w, row) => {
    const ry = moonY + row * 3;
    pxRect(ctx, moonX - w / 2 - 2, ry, w + 4, 4, border);
  });
  spans.forEach((w, row) => {
    const ry = moonY + row * 3;
    if (row > 0 && row < spans.length - 1) {
      pxRect(ctx, moonX - w / 2, ry, w, 4, pal.moon);
    }
  });
  pxRect(ctx, moonX - 8, moonY + 12, 6, 6, pal.moonCrater);
  pxRect(ctx, moonX + 4, moonY + 22, 8, 6, pal.moonCrater);

  // Far stepped 8-bit lavender mountain range
  const farScroll = reducedMotion ? 0 : Math.floor((state.cameraX * 0.16) / 8) * 8;
  for (let sx = 0; sx < WORLD_WIDTH; sx += 8) {
    const wx = sx + farScroll;
    const h = farMtnHeight(wx);
    const nextH = farMtnHeight(wx + 8);
    pxRect(ctx, sx, h, 8, GROUND_Y - h, nextH > h ? pal.farShade : pal.farMtn);
    pxRect(ctx, sx, h, 8, PX, border);
    if (nextH !== h) {
      const top = Math.min(h, nextH);
      const diff = Math.abs(nextH - h);
      pxRect(ctx, sx + 6, top, PX, diff + PX, border);
    }
  }

  // Mid stepped 8-bit mint hills + pixel GitHub lunar outposts
  const midScroll = reducedMotion ? 0 : Math.floor((state.cameraX * 0.36) / 8) * 8;
  for (let sx = 0; sx < WORLD_WIDTH; sx += 8) {
    const wx = sx + midScroll;
    const h = midHillHeight(wx);
    const nextH = midHillHeight(wx + 8);
    pxRect(ctx, sx, h, 8, GROUND_Y - h, nextH > h ? pal.midShade : pal.midHill);
    pxRect(ctx, sx, h, 8, PX, border);
    if (nextH !== h) {
      pxRect(ctx, sx + 6, Math.min(h, nextH), PX, Math.abs(nextH - h) + PX, border);
    }
  }

  // Pixel REPO domes & branch masts on mid hills
  const domePeriod = 256;
  const firstDome = Math.floor(midScroll / domePeriod) * domePeriod;
  for (let dx = firstDome; dx < midScroll + WORLD_WIDTH + domePeriod; dx += domePeriod) {
    const sx = snap(dx - midScroll);
    const baseY = midHillHeight(dx);
    // Antenna mast
    pxRect(ctx, sx + 12, baseY - 26, PX, 12, border);
    pxRect(ctx, sx + 10, baseY - 30, 6, 6, pal.pink);
    // Stepped pixel dome
    pxFrame(ctx, sx, baseY - 16, 28, 16, pal.dome, border);
    pxFrame(ctx, sx + 4, baseY - 20, 20, 6, pal.domeRoof, border);
    pxRect(ctx, sx + 10, baseY - 10, 8, 8, pal.ink);
  }
}

function drawPixelRoadAndCraters(ctx, state, pal, reducedMotion, dark) {
  const camX = snap(state.cameraX);
  const border = dark ? pal.outlineLight : pal.ink;

  const craters = state.course.obstacles.filter(
    (o) =>
      o.kind.startsWith('crater') &&
      o.x + o.width >= camX - 32 &&
      o.x <= camX + WORLD_WIDTH + 32,
  );

  // Draw road in 4px stepped columns
  for (let sx = 0; sx < WORLD_WIDTH; sx += 4) {
    const wx = camX + sx;
    const crater = craters.find((c) => wx >= c.x && wx < c.x + c.width);
    if (crater) {
      const rel = (wx - crater.x) / crater.width;
      const stepDepth = rel < 0.2 || rel > 0.8 ? 14 : rel < 0.38 || rel > 0.62 ? 26 : 36;
      const pitY = GROUND_Y + stepDepth;
      pxRect(ctx, sx, GROUND_Y, 4, stepDepth, pal.craterPit);
      pxRect(ctx, sx, pitY, 4, WORLD_HEIGHT - pitY, pal.roadDeep);
      pxRect(ctx, sx, pitY, 4, PX * 2, border);
    } else {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates);
      pxRect(ctx, sx, gy, 4, 16, pal.roadTop);
      pxRect(ctx, sx, gy + 16, 4, 18, pal.roadMid);
      pxRect(ctx, sx, gy + 34, 4, WORLD_HEIGHT - (gy + 34), pal.roadDeep);
      pxRect(ctx, sx, gy, 4, PX * 2, border);
    }
  }

  // Crater vertical pixel walls, alternating hazard blocks, and bitmap `<<<`
  for (const crater of craters) {
    const lx = snap(crater.x - camX);
    const rx = snap(crater.x + crater.width - camX);
    pxRect(ctx, lx - PX, GROUND_Y, PX * 2, 18, border);
    pxRect(ctx, rx - PX, GROUND_Y, PX * 2, 18, border);

    // 8-bit warning blocks on crater rims
    pxFrame(ctx, lx - 8, GROUND_Y - 10, 8, 10, pal.gold, border);
    pxFrame(ctx, rx, GROUND_Y - 10, 8, 10, pal.gold, border);

    drawBitmapText(
      ctx,
      '<<<',
      (lx + rx) * 0.5 - 16,
      GROUND_Y + 14,
      2,
      pal.ruby,
    );
  }

  // Scrolling pixel pebbles in regolith to give crisp 8-bit sense of speed
  const pebbleShift = reducedMotion ? 0 : Math.floor(camX / PX) * PX;
  for (let px = -((pebbleShift) % 48); px < WORLD_WIDTH; px += 48) {
    const wx = camX + px;
    const inCrater = craters.some((c) => wx >= c.x - 8 && wx <= c.x + c.width + 8);
    if (!inCrater) {
      pxRect(ctx, px, GROUND_Y + 8, 6, 4, pal.pebble);
      pxRect(ctx, px + 22, GROUND_Y + 22, 8, 4, pal.pebble);
    }
  }
}

function drawPixelGatesAndObstacles(ctx, state, pal, dark) {
  const camX = snap(state.cameraX);
  const border = dark ? pal.outlineLight : pal.ink;

  // 8-bit Checkpoint Signposts & Checkered Goal Arch (E, J, O, T, Z)
  for (const gate of state.course.gates) {
    const sx = snap(gate.x - camX);
    if (sx < -80 || sx > WORLD_WIDTH + 80) continue;
    const gy = groundYAt(gate.x, state.course.obstacles, state.course.gates);

    if (gate.isMajor) {
      // Grand 8-bit checkered finish arch for Checkpoint E!
      pxRect(ctx, sx - 6, gy - 84, 6, 84, border);
      pxRect(ctx, sx + 54, gy - 84, 6, 84, border);
      pxFrame(ctx, sx - 12, gy - 106, 78, 26, gate.reached ? pal.mint : pal.pink, border);
      // Checkered pixel trim along top of arch
      for (let c = 0; c < 12; c++) {
        pxRect(
          ctx,
          sx - 10 + c * 6,
          gy - 104,
          6,
          4,
          c % 2 === 0 ? pal.ink : pal.paper,
        );
      }
      drawBitmapText(ctx, `GOAL ${gate.letter}`, sx + 4, gy - 94, 2, pal.ink);
    } else {
      pxRect(ctx, sx, gy - 62, 4, 62, border);
      pxFrame(ctx, sx + 4, gy - 62, 34, 24, gate.reached ? pal.mint : pal.lavender, border);
      drawBitmapText(
        ctx,
        gate.reached ? `${gate.letter}+` : gate.letter,
        sx + 13,
        gy - 55,
        2,
        pal.ink,
      );
    }
  }

  // 8-bit Pixel Boulders & Mines
  const rockColors = {
    k: pal.ink,
    l: pal.lavender,
    i: pal.paper,
    s: pal.purple,
  };

  for (const obs of state.course.obstacles) {
    if (obs.destroyed || obs.kind.startsWith('crater')) continue;
    const sx = snap(obs.x - camX);
    if (sx + obs.width < -32 || sx > WORLD_WIDTH + 32) continue;
    const gy = groundYAt(
      obs.x + obs.width * 0.5,
      state.course.obstacles,
      state.course.gates,
    );

    if (obs.kind === 'mine') {
      pxFrame(ctx, sx, gy - 12, 22, 12, pal.pink, border);
      pxRect(ctx, sx + 4, gy - 16, 4, 4, pal.ruby);
      pxRect(ctx, sx + 10, gy - 18, 4, 6, pal.ruby);
      pxRect(ctx, sx + 16, gy - 16, 4, 4, pal.ruby);
      drawBitmapText(ctx, '!', sx + 8, gy - 11, 2, pal.ink);
      continue;
    }

    if (obs.kind === 'rock-tall') {
      drawSprite(ctx, ROCK_TALL_MAP, sx, gy - 32, rockColors, PX);
      if (obs.hp < obs.maxHp) {
        // Stepped 8-bit damage crack
        pxRect(ctx, sx + 14, gy - 28, 4, 8, pal.ruby);
        pxRect(ctx, sx + 10, gy - 20, 4, 8, pal.ruby);
        pxRect(ctx, sx + 14, gy - 12, 4, 8, pal.ruby);
      }
    } else {
      drawSprite(ctx, ROCK_SMALL_MAP, sx, gy - 22, rockColors, PX);
    }
  }
}

// Draws canonical Pixel Mona sitting prominently in the open-top 8-bit 6-wheel rover!
function drawRoverAndMona(ctx, state, pal, reducedMotion) {
  if (state.invulnTimer > 0 && Math.floor(state.invulnTimer * 12) % 2 === 1) {
    return;
  }

  const bx = snap(state.buggy.screenX);
  // Subtle airborne lift tilt via stepped pixel offset (keeps crisp integer pixels, no blur!)
  const bodyLift = !state.buggy.grounded ? -2 : 0;
  const by = snap(state.buggy.y);

  const animFrame = reducedMotion ? 0 : Math.floor(state.buggy.wheelPhase * 0.6) % 2;

  // 1. Boost 8-bit pixel thruster flame behind rover
  if (state.gearIndex === 2 && state.status === 'playing') {
    const flameLen = animFrame === 0 ? 14 : 10;
    pxRect(ctx, bx - 34 - flameLen, by - 20 + bodyLift, flameLen, 8, pal.gold);
    pxRect(ctx, bx - 30 - flameLen / 2, by - 18 + bodyLift, flameLen / 2, 4, pal.ruby);
  }

  // 2. Canonical Pixel Mona in the open cockpit (46x28 px — tall ears, wide ivory face,
  //    vertical eyes, peach blush, cute mouth, and waving Octocat tentacle!)
  const monaMap = animFrame === 0 ? MONA_PILOT_A : MONA_PILOT_B;
  drawSprite(
    ctx,
    monaMap,
    bx - 22,
    by - 50 + bodyLift,
    {
      k: '#34313e',
      i: '#fffdf4',
      c: '#ffb7a5',
      q: '#96dce2',
    },
    PX,
  );

  // 3. Rear deck upward anti-air plasma turret (behind Mona so her face is 100% clear)
  pxFrame(ctx, bx - 30, by - 30 + bodyLift, 10, 10, pal.aqua, '#34313e');
  pxRect(ctx, bx - 27, by - 34 + bodyLift, 4, 4, pal.leaf);

  // 4. Open-top 8-bit candy-pink & lavender 6-wheel rover chassis
  pxFrame(ctx, bx - 34, by - 22 + bodyLift, 68, 12, pal.pink, '#34313e');
  // Top highlight & side panel pixel trim
  pxRect(ctx, bx - 30, by - 20 + bodyLift, 58, 2, pal.peach);
  pxRect(ctx, bx - 18, by - 16 + bodyLift, 36, 4, pal.lavender);

  // 5. Front pixel laser cannon on bumper
  pxFrame(ctx, bx + 32, by - 20 + bodyLift, 8, 8, pal.gold, '#34313e');
  pxRect(ctx, bx + 40, by - 18 + bodyLift, 4, 4, pal.ruby);

  // 6. Three chunky 14x14 pixel wheels on independent bouncing pixel suspension struts
  const wheelMap = animFrame === 0 ? WHEEL_A : WHEEL_B;
  const wheelColors = { k: '#34313e', i: '#fffdf4' };
  for (const [idx, wxOff] of [-22, 0, 22].entries()) {
    const bounce =
      reducedMotion || !state.buggy.grounded
        ? 0
        : Math.round(Math.sin(state.buggy.wheelPhase + idx * 1.8)) * PX;
    const wy = by - 14 + bounce;

    // Suspension strut pixels
    pxRect(ctx, bx + wxOff - 2, by - 12 + bodyLift, 4, 6, '#34313e');
    drawSprite(ctx, wheelMap, bx + wxOff - 7, wy, wheelColors, PX);
  }
}

function drawAerialAndProjectiles(ctx, state, pal, reducedMotion) {
  const camX = snap(state.cameraX);

  // 8-bit pixel laser & upward plasma bolts
  for (const shot of state.shots) {
    const sx = snap(shot.x - camX);
    const sy = snap(shot.y);
    if (shot.kind === 'forward') {
      pxFrame(ctx, sx - 10, sy - 4, 20, 8, pal.ruby, '#34313e');
      pxRect(ctx, sx - 6, sy - 2, 12, 2, pal.paper);
    } else {
      pxFrame(ctx, sx - 4, sy - 10, 8, 18, pal.aqua, '#34313e');
      pxRect(ctx, sx - 2, sy - 6, 4, 10, pal.paper);
    }
  }

  // Left-to-right 8-bit Bug Saucers passing overhead
  const ufoFrame = reducedMotion ? 0 : Math.floor(state.elapsed * 6) % 2;
  for (const ufo of state.ufos) {
    const ux = snap(ufo.screenX - 20);
    const uy = snap(ufo.y - 12);
    drawSprite(
      ctx,
      ufoFrame === 0 ? UFO_SPRITE_A : UFO_SPRITE_B,
      ux,
      uy,
      {
        k: '#34313e',
        q: pal.aqua,
        p: ufo.kind === 'bomber' ? pal.gold : pal.pink,
        i: pal.paper,
      },
      PX,
    );
  }

  // Slow-drifting blinking 8-bit saucer flares
  const blink = !reducedMotion && Math.floor(state.elapsed * 10) % 2 === 0;
  for (const bomb of state.bombs) {
    const sx = snap(bomb.x - camX);
    const sy = snap(bomb.y);
    pxFrame(ctx, sx - 6, sy - 6, 12, 12, blink ? pal.gold : pal.pink, '#34313e');
    pxRect(ctx, sx - 2, sy - 10, 4, 4, '#34313e');
  }

  // Chunky 8-bit square explosion pixels
  for (const p of state.particles) {
    const sx = snap(p.x - camX);
    const sy = snap(p.y);
    const size = p.life > p.maxLife * 0.5 ? 8 : 6;
    const fill =
      p.colorKind === 'ruby'
        ? pal.ruby
        : p.colorKind === 'lavender'
          ? pal.lavender
          : p.colorKind === 'mint'
            ? pal.aqua
            : pal.gold;
    pxFrame(ctx, sx - size / 2, sy - size / 2, size, size, fill, '#34313e');
  }
}

function drawPixelHudBezel(ctx, state, pal, dark) {
  const border = dark ? pal.outlineLight : pal.ink;
  const textCol = dark ? pal.paper : pal.ink;

  // Overhead UFO alert banner in upper-left
  if (state.ufos.length > 0) {
    pxFrame(ctx, 12, 10, 152, 22, pal.pink, border);
    drawBitmapText(ctx, `BUGS ${state.ufos.length}`, 22, 16, 2, pal.ink);
    drawBitmapText(ctx, '>>>', 110, 16, 2, pal.ruby);
  }

  // Gear speed box in upper-right
  const gear = GEARS[state.gearIndex];
  pxFrame(ctx, WORLD_WIDTH - 134, 10, 122, 22, pal.hudBg, border);
  for (let g = 0; g < 3; g++) {
    pxFrame(
      ctx,
      WORLD_WIDTH - 126 + g * 12,
      15,
      10,
      12,
      g <= state.gearIndex ? pal.mint : pal.skyBand,
      border,
    );
  }
  drawBitmapText(ctx, gear.label, WORLD_WIDTH - 84, 16, 2, textCol);

  // Bottom 8-bit A-B-C-D-E Sector Progress Radar Strip
  const barX = 20;
  const barY = 328;
  const barW = WORLD_WIDTH - 40;
  pxFrame(ctx, barX, barY, barW, 24, pal.hudBg, border);

  drawBitmapText(ctx, state.course.sectorName, barX + 10, barY + 7, 2, textCol);

  const letters = sectorCheckpointLetters(state.checkpointIndex);
  const trackLeft = barX + 86;
  const trackRight = barX + barW - 22;
  const trackW = trackRight - trackLeft;
  const ratio = Math.max(0, Math.min(1, state.buggy.worldX / Math.max(1, state.course.length)));

  pxRect(ctx, trackLeft, barY + 11, trackW, 4, border);
  pxRect(ctx, trackLeft, barY + 11, trackW * ratio, 4, pal.leaf);

  letters.forEach((letter, idx) => {
    const lx = snap(trackLeft + (trackW * idx) / Math.max(1, letters.length - 1));
    const reached = state.course.gates[idx]?.reached;
    pxFrame(ctx, lx - 8, barY + 4, 16, 16, reached ? pal.mint : pal.paper, border);
    drawBitmapText(ctx, letter, lx - 3, barY + 7, 2, pal.ink);
  });

  // Live pixel rover marker on radar
  const markerX = snap(trackLeft + trackW * ratio);
  pxRect(ctx, markerX - 4, barY - 2, 8, 6, pal.ruby);
}

export function renderGame(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dark = options.theme === 'dark';
  const reducedMotion = Boolean(options.reducedMotion);
  const pal = dark ? PALETTES.dark : PALETTES.light;

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

  drawSkyAndParallax(ctx, state, pal, reducedMotion, dark);
  drawPixelRoadAndCraters(ctx, state, pal, reducedMotion, dark);
  drawPixelGatesAndObstacles(ctx, state, pal, dark);
  if (state.status !== 'crashing' || state.crashTimer > 0.35) {
    drawRoverAndMona(ctx, state, pal, reducedMotion);
  }
  drawAerialAndProjectiles(ctx, state, pal, reducedMotion);
  drawPixelHudBezel(ctx, state, pal, dark);

  ctx.restore();
}
