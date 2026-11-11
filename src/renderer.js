// Fine-detail Golden-Age Retro Arcade 2D Canvas renderer for Mona Patrol (640x360 @ DPR).
// Combines crisp retro pixel sprites & craggy two-tone arcade landscapes with high visual
// clarity: simple unmistakable road craters, slope-aligned high-contrast mines, full-depth
// parallax layers behind hill valleys, unmistakable Mona in her 6-wheel pink rover, and
// visually distinct Tri-Orb Bug-Dropper vs Horned CVE-Bomber saucers.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GROUND_Y,
  GEARS,
  groundYAt,
  sectorCheckpointLetters,
} from './engine.js';

const STAGE_THEMES = [
  // Stage 1 (A–E): Lunar Crater Ridge
  {
    light: {
      skyTop: '#fff7df', skyBot: '#f5ebd0', starA: '#c3b2e3', starB: '#f09d8c',
      farMtn: '#cbbce6', farRidge: '#e8dff7', midHill: '#9fd49c', midRidge: '#ccf0c2',
      roadLip: '#7bc96f', roadTop: '#f4a27e', roadMid: '#dc8562', craterShadow: '#33293a',
    },
    dark: {
      skyTop: '#090b16', skyBot: '#121629', starA: '#fffdf4', starB: '#70d6ff',
      farMtn: '#1f2d5a', farRidge: '#3b57a8', midHill: '#1c5446', midRidge: '#368f75',
      roadLip: '#5cd669', roadTop: '#e88b48', roadMid: '#c46c2d', craterShadow: '#070811',
    },
  },
  // Stage 2 (F–J): Octo Metropolis — inspired by classic alien spire city skyline
  {
    light: {
      skyTop: '#e3f4ff', skyBot: '#cde8fa', starA: '#70b8e8', starB: '#f5b841',
      farMtn: '#7ea8e0', farRidge: '#adcbf5', midHill: '#62ba85', midRidge: '#92e0b0',
      roadLip: '#52bd64', roadTop: '#f29f58', roadMid: '#d67e3a', craterShadow: '#232b3d',
    },
    dark: {
      skyTop: '#050814', skyBot: '#0b132b', starA: '#96dce2', starB: '#f7d274',
      farMtn: '#12326b', farRidge: '#245bc2', midHill: '#185e3f', midRidge: '#32a872',
      roadLip: '#4ad658', roadTop: '#ef923e', roadMid: '#c76f22', craterShadow: '#04060f',
    },
  },
  // Stage 3 (K–O): Canary Minefield — twilight sunset & radar arrays
  {
    light: {
      skyTop: '#ffede3', skyBot: '#fadac9', starA: '#d98cb3', starB: '#e8a838',
      farMtn: '#cfa0bf', farRidge: '#ebd0e2', midHill: '#deb868', midRidge: '#f7dc9c',
      roadLip: '#d99b38', roadTop: '#e8b36b', roadMid: '#c98f47', craterShadow: '#36242e',
    },
    dark: {
      skyTop: '#160b1c', skyBot: '#291533', starA: '#ffb7a5', starB: '#f7d274',
      farMtn: '#4a2249', farRidge: '#823f80', midHill: '#573f22', midRidge: '#8f6b3b',
      roadLip: '#f0b849', roadTop: '#d69747', roadMid: '#ab6f26', craterShadow: '#0d0611',
    },
  },
  // Stage 4 (P–T): Rolling Highlands — glacier canyon mesas & undulating hills
  {
    light: {
      skyTop: '#e6faf5', skyBot: '#cef0e8', starA: '#7b8cde', starB: '#5ec788',
      farMtn: '#99b0de', farRidge: '#c4d4f5', midHill: '#6dc4b0', midRidge: '#a3ebd9',
      roadLip: '#5bc489', roadTop: '#b996e3', roadMid: '#9771c4', craterShadow: '#222d38',
    },
    dark: {
      skyTop: '#08131c', skyBot: '#102433', starA: '#96dce2', starB: '#c5e7b1',
      farMtn: '#1d3654', farRidge: '#366396', midHill: '#1d4f4d', midRidge: '#368c87',
      roadLip: '#5ce0a8', roadTop: '#9c78cf', roadMid: '#7552a8', craterShadow: '#050b11',
    },
  },
  // Stage 5 (U–Z): Omega Citadel — royal amethyst & energy arches
  {
    light: {
      skyTop: '#f4e8fc', skyBot: '#e5d1f5', starA: '#d63e6c', starB: '#e8b038',
      farMtn: '#b497db', farRidge: '#dac7f5', midHill: '#85ccb6', midRidge: '#b5f0dd',
      roadLip: '#52c49c', roadTop: '#f08aa3', roadMid: '#cf637e', craterShadow: '#2e1d38',
    },
    dark: {
      skyTop: '#11081f', skyBot: '#1f1038', starA: '#ff7b9c', starB: '#f7d274',
      farMtn: '#391d5e', farRidge: '#6b3ab0', midHill: '#1f4d48', midRidge: '#3a8f85',
      roadLip: '#5ce6b8', roadTop: '#de6889', roadMid: '#ad4261', craterShadow: '#090412',
    },
  },
];

// Fine 1px-grid canonical Mona sprite (30x19 @ 1px -> drawn at 1.5x or integer 1px/2px?
// Wait: 28x18 @ 1.5px -> let's use a 28x19 map drawn at integer 1px on 640x360? 28px wide is crisp AND detailed!
// Even better: 34x22 @ 1px = 34x22 logical px (68x44 physical retina pixels at DPR 2!!))
const MONA_FINE_A = [
  '.......kkkk............kkkk.......',
  '......kkkkkk..........kkkkkk......',
  '......kkkkkkk........kkkkkkk......',
  '.....kkkkkkkkkkkkkkkkkkkkkkkk.....',
  '....kkkkkkkkkkkkkkkkkkkkkkkkkk....',
  '...kkkkiiiiiiiiiiiiiiiiiiiikkkk...',
  '...kkkiiiiiiiiiiiiiiiiiiiiiikkk...',
  '..kkkiiiiiiiiiiiiiiiiiiiiiiiikkk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiiikkwkiiiiiiiiiikkwkiiiikk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiicccciiiikkkkiiiicccciiikk..',
  '...kkiiiiiiiiiiikkiiiiiiiiiiikk...',
  '...kkkiiiiiiiiiiiiiiiiiiiiiikkk...',
  '.kk.kkkkkkkkkkkkkkkkkkkkkkkkkk....',
  'kkkk..kkkkkkkkkkkkkkkkkkkkkkqqq...',
  'kkkk...kkkkkkkkkkkkkkkkkkkkqqqqq..',
  '.kkk.....kkkkkkkkkkkkkkkkkqq..qq..',
];

const MONA_FINE_B = [
  '.......kkkk............kkkk.......',
  '......kkkkkk..........kkkkkk......',
  '......kkkkkkk........kkkkkkk......',
  '.....kkkkkkkkkkkkkkkkkkkkkkkk.....',
  '....kkkkkkkkkkkkkkkkkkkkkkkkkk....',
  '...kkkkiiiiiiiiiiiiiiiiiiiikkkk...',
  '...kkkiiiiiiiiiiiiiiiiiiiiiikkk...',
  '..kkkiiiiiiiiiiiiiiiiiiiiiiiikkk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiiikkwkiiiiiiiiiikkwkiiiikk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiiikkkkiiiiiiiiiikkkkiiiikk..',
  '..kkiiicccciiiikkkkiiiicccciiikk..',
  '.kk.kkiiiiiiiiiiikkiiiiiiiiiiikk..',
  'kkkk.kkkiiiiiiiiiiiiiiiiiiiiiikkk.',
  '.kkk..kkkkkkkkkkkkkkkkkkkkkkkk....',
  '.......kkkkkkkkkkkkkkkkkkkkkqqq...',
  '........kkkkkkkkkkkkkkkkkkkqqqqq..',
  '.........kkkkkkkkkkkkkkkkkqq..qq..',
];

function drawPixelSprite1x(ctx, map, x, y, colors) {
  const ox = Math.round(x);
  const oy = Math.round(y);
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(ox + c, oy + r, 1, 1);
    }
  }
}

function farCragHeight(wx, sectorIdx) {
  if (sectorIdx === 3) {
    // Terraced canyon plateaus with fine crags
    const plateau = Math.sin(wx * 0.006) * 28;
    const stepped = Math.round(plateau / 10) * 10;
    const micro = Math.sin(wx * 0.05) * 2;
    return 182 + stepped + micro;
  }
  // Craggy arcade mountain peaks (multi-harmonic jagged silhouette)
  return (
    182 +
    Math.sin(wx * 0.008 + sectorIdx) * 28 +
    Math.cos(wx * 0.021 + sectorIdx * 1.7) * 14 +
    Math.sin(wx * 0.063) * 5
  );
}

function midRidgeHeight(wx, sectorIdx) {
  return (
    234 +
    Math.sin(wx * 0.013 + 1.4 + sectorIdx * 0.8) * 15 +
    Math.cos(wx * 0.037) * 6 +
    Math.sin(wx * 0.09) * 2
  );
}

function drawStageBuildings(ctx, sectorIdx, midScroll, stagePal, dark) {
  const floorY = 336; // Extends well below deepest Stage 4 valley so zero gaps ever appear!

  if (sectorIdx === 0) {
    // Stage 1 (A–E): Clean retro lunar domes & comm antennae
    const period = 260;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = Math.round(dx - midScroll);
      const baseY = Math.round(midRidgeHeight(dx, sectorIdx)) + 4;
      // Mast
      ctx.fillStyle = '#34313e';
      ctx.fillRect(sx + 13, baseY - 28, 2, 14);
      ctx.fillStyle = '#ff7b9c';
      ctx.fillRect(sx + 11, baseY - 31, 6, 4);
      // Dome
      ctx.fillStyle = dark ? '#29324d' : '#fffdf4';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx + 14, baseY - 4, 13, Math.PI, 0);
      ctx.lineTo(sx + 27, baseY + 12);
      ctx.lineTo(sx + 1, baseY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Lit visor window
      ctx.fillStyle = '#70d6ff';
      ctx.fillRect(sx + 7, baseY - 11, 14, 4);
    }
    return;
  }

  if (sectorIdx === 1) {
    // Stage 2 (F–J): Octo Metropolis — Bulbous emerald futuristic city spires with
    // warm sunlit yellow right-side shading & lit window slits (classic Point F–J homage!)
    const period = 136;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const variant = Math.abs(Math.floor(dx / period)) % 3;
      const sx = Math.round(dx - midScroll);
      const baseTop = 278;

      const bodyGreen = dark ? '#1f8a4c' : '#45b874';
      const sunGold = '#f0cf56';
      const winDark = '#0b1911';

      if (variant === 0) {
        // Tall tiered bulbous spire
        ctx.fillStyle = bodyGreen;
        ctx.fillRect(sx + 10, baseTop - 78, 32, floorY - (baseTop - 78));
        ctx.fillStyle = sunGold;
        ctx.fillRect(sx + 34, baseTop - 76, 8, floorY - (baseTop - 76));

        // Bulbous mid pod
        ctx.fillStyle = bodyGreen;
        ctx.beginPath();
        ctx.roundRect(sx + 2, baseTop - 58, 48, 22, 9);
        ctx.fill();
        ctx.fillStyle = sunGold;
        ctx.fillRect(sx + 40, baseTop - 54, 8, 14);

        // Crown dome + twin antennae
        ctx.fillStyle = bodyGreen;
        ctx.beginPath();
        ctx.roundRect(sx + 8, baseTop - 86, 36, 14, 7);
        ctx.fill();
        ctx.fillStyle = sunGold;
        ctx.fillRect(sx + 12, baseTop - 98, 2, 12);
        ctx.fillRect(sx + 36, baseTop - 94, 2, 10);

        // Window slits
        ctx.fillStyle = winDark;
        for (let wx = sx + 8; wx < sx + 42; wx += 6) {
          ctx.fillRect(wx, baseTop - 49, 3, 3);
        }
        for (let wy = baseTop - 72; wy < baseTop - 16; wy += 11) {
          ctx.fillRect(sx + 15, wy, 14, 2);
        }
      } else if (variant === 1) {
        // Wide saucer-head observation tower with V-antennae
        ctx.fillStyle = bodyGreen;
        ctx.fillRect(sx + 16, baseTop - 52, 24, floorY - (baseTop - 52));
        ctx.fillStyle = sunGold;
        ctx.fillRect(sx + 33, baseTop - 50, 7, floorY - (baseTop - 50));

        ctx.fillStyle = bodyGreen;
        ctx.beginPath();
        ctx.ellipse(sx + 28, baseTop - 58, 28, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sunGold;
        ctx.beginPath();
        ctx.ellipse(sx + 35, baseTop - 58, 18, 9, 0, -0.7, 0.7);
        ctx.fill();

        // V-antennae
        ctx.strokeStyle = bodyGreen;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + 25, baseTop - 68);
        ctx.lineTo(sx + 19, baseTop - 80);
        ctx.moveTo(sx + 31, baseTop - 68);
        ctx.lineTo(sx + 37, baseTop - 80);
        ctx.stroke();

        ctx.fillStyle = winDark;
        for (let wx = sx + 8; wx <= sx + 44; wx += 6) {
          ctx.fillRect(wx, baseTop - 59, 4, 2);
        }
      } else {
        // Twin bio-towers
        ctx.fillStyle = dark ? '#176e3c' : '#369e60';
        ctx.beginPath();
        ctx.roundRect(sx + 4, baseTop - 64, 24, floorY - (baseTop - 64), 8);
        ctx.fill();

        ctx.fillStyle = bodyGreen;
        ctx.beginPath();
        ctx.roundRect(sx + 24, baseTop - 46, 24, floorY - (baseTop - 46), 8);
        ctx.fill();
        ctx.fillStyle = sunGold;
        ctx.fillRect(sx + 41, baseTop - 40, 6, floorY - (baseTop - 40));

        ctx.fillStyle = winDark;
        for (let wy = baseTop - 54; wy < baseTop - 16; wy += 10) {
          ctx.fillRect(sx + 9, wy, 12, 2);
        }
      }
    }
    return;
  }

  if (sectorIdx === 2) {
    // Stage 3 (K–O): Canary Minefield — Parabolic radar dishes & comm towers
    const period = 190;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = Math.round(dx - midScroll);
      const baseY = Math.round(midRidgeHeight(dx, sectorIdx)) + 6;
      ctx.strokeStyle = dark ? '#a86b9c' : '#5e3d58';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 8, floorY);
      ctx.lineTo(sx + 16, baseY - 38);
      ctx.lineTo(sx + 24, floorY);
      ctx.moveTo(sx + 11, baseY - 18);
      ctx.lineTo(sx + 21, baseY - 18);
      ctx.stroke();

      // Dish
      ctx.fillStyle = dark ? '#d99ec9' : '#fffdf4';
      ctx.beginPath();
      ctx.arc(sx + 16, baseY - 44, 14, 0.25 * Math.PI, 0.95 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(sx + 15, baseY - 56, 3, 10);
      ctx.fillRect(sx + 14, baseY - 58, 5, 4);
    }
    return;
  }

  if (sectorIdx === 3) {
    // Stage 4 (P–T): Rolling Highlands — Tall bridge pylons extending deep behind valleys
    const period = 216;
    const first = Math.floor(midScroll / period) * period;
    for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
      const sx = Math.round(dx - midScroll);
      const baseY = Math.round(midRidgeHeight(dx, sectorIdx));
      ctx.fillStyle = dark ? '#294c66' : '#6d8db5';
      ctx.fillRect(sx + 8, baseY - 58, 12, floorY - (baseY - 58));
      ctx.fillStyle = '#f5cc66';
      ctx.fillRect(sx + 3, baseY - 44, 22, 5);
      ctx.fillStyle = '#70d6ff';
      ctx.fillRect(sx + 5, baseY - 62, 18, 6);
    }
    return;
  }

  // Stage 5 (U–Z): Omega Citadel — Twin obelisks & energy arches
  const period = 176;
  const first = Math.floor(midScroll / period) * period;
  for (let dx = first; dx < midScroll + WORLD_WIDTH + period; dx += period) {
    const sx = Math.round(dx - midScroll);
    const baseTop = 274;
    ctx.fillStyle = dark ? '#4d2b7a' : '#8a66ba';
    ctx.fillRect(sx + 6, baseTop - 68, 12, floorY - (baseTop - 68));
    ctx.fillRect(sx + 34, baseTop - 68, 12, floorY - (baseTop - 68));
    ctx.fillStyle = '#f5cc66';
    ctx.fillRect(sx + 2, baseTop - 76, 48, 9);
    ctx.fillStyle = '#ff4d79';
    ctx.fillRect(sx + 10, baseTop - 73, 32, 3);
  }
}

function drawSkyAndParallax(ctx, state, stagePal, reducedMotion, dark) {
  const sectorIdx = state.sectorIndex ?? 0;
  const floorY = 338; // Extends past deepest hill valley (`y = 304`) so zero background gaps occur!

  const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
  skyGrad.addColorStop(0, stagePal.skyTop);
  skyGrad.addColorStop(1, stagePal.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Crisp 1px-2px twinkling stars
  const starOffset = reducedMotion ? 0 : state.cameraX * 0.05;
  const starCoords = [
    [52, 24], [138, 42], [224, 20], [318, 48], [412, 26], [578, 38],
    [96, 80], [276, 74], [458, 68], [186, 102], [528, 94],
  ];
  for (const [idx, [sx, sy]] of starCoords.entries()) {
    const px = Math.round((((sx - starOffset) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH);
    const blink = !reducedMotion && Math.floor(state.elapsed * 3 + idx) % 5 === 0;
    ctx.fillStyle = idx % 2 === 0 ? stagePal.starA : stagePal.starB;
    if (blink) {
      ctx.fillRect(px - 3, sy, 7, 1);
      ctx.fillRect(px, sy - 3, 1, 7);
    } else {
      ctx.fillRect(px, sy, 2, 2);
    }
  }

  // Planet / Moon in upper-right sky
  const moonX = 524;
  const moonY = 48;
  ctx.fillStyle = sectorIdx % 2 === 1 ? '#f7d97e' : '#fffdf4';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 105, 155, 0.28)';
  ctx.beginPath();
  ctx.arc(moonX - 4, moonY - 3, 3.5, 0, Math.PI * 2);
  ctx.arc(moonX + 5, moonY + 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (sectorIdx >= 2) {
    ctx.strokeStyle = '#ff8fab';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(moonX, moonY + 1, 26, 5, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Far craggy mountain range (2px horizontal resolution, two-tone lit ridge, NO white border!)
  const farScroll = reducedMotion ? 0 : state.cameraX * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    ctx.lineTo(sx, farCragHeight(sx + farScroll, sectorIdx));
  }
  ctx.lineTo(WORLD_WIDTH, floorY);
  ctx.closePath();
  ctx.fillStyle = stagePal.farMtn;
  ctx.fill();

  // Lit ridge cap along far peaks
  ctx.strokeStyle = stagePal.farRidge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    const y = farCragHeight(sx + farScroll, sectorIdx);
    if (sx === 0) ctx.moveTo(sx, y + 1);
    else ctx.lineTo(sx, y + 1);
  }
  ctx.stroke();

  // Mid hills (extends all the way to floorY = 338 behind foreground valleys!)
  const midScroll = reducedMotion ? 0 : state.cameraX * 0.36;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    ctx.lineTo(sx, midRidgeHeight(sx + midScroll, sectorIdx));
  }
  ctx.lineTo(WORLD_WIDTH, floorY);
  ctx.closePath();
  ctx.fillStyle = stagePal.midHill;
  ctx.fill();

  ctx.strokeStyle = stagePal.midRidge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    const y = midRidgeHeight(sx + midScroll, sectorIdx);
    if (sx === 0) ctx.moveTo(sx, y + 1);
    else ctx.lineTo(sx, y + 1);
  }
  ctx.stroke();

  // Stage-specific skyline structures
  drawStageBuildings(ctx, sectorIdx, midScroll, stagePal, dark);
}

// Clean, simple, unmistakable craters: the road surface simply drops into a deep shadowed
// V/U chasm with zero distracting edge boxes or text!
function drawRoadAndSimpleCraters(ctx, state, stagePal, reducedMotion) {
  const camX = state.cameraX;
  const sectorIdx = state.sectorIndex ?? 0;

  const craters = state.course.obstacles.filter(
    (o) =>
      o.kind.startsWith('crater') &&
      o.x + o.width >= camX - 32 &&
      o.x <= camX + WORLD_WIDTH + 32,
  );

  function roadProfileY(sx) {
    const wx = camX + sx;
    const crater = craters.find((c) => wx > c.x && wx < c.x + c.width);
    if (crater) {
      const t = (wx - crater.x) / crater.width; // 0..1 across crater
      const depth = crater.kind === 'crater-wide' ? 42 : 34;
      // Clean steep rocky drop into flat/angled crater floor
      const profile =
        t < 0.22
          ? t / 0.22
          : t > 0.78
            ? (1 - t) / 0.22
            : 0.88 + Math.sin(t * Math.PI * 3) * 0.12;
      return GROUND_Y + depth * profile;
    }
    return groundYAt(wx, state.course.obstacles, state.course.gates, sectorIdx);
  }

  // Dark crater shadow backdrop behind road cutout so craters read instantly as open pits
  for (const crater of craters) {
    const lx = crater.x - camX;
    ctx.fillStyle = stagePal.craterShadow;
    ctx.fillRect(lx, GROUND_Y, crater.width, 46);
  }

  // Main lunar soil polygon
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    ctx.lineTo(sx, roadProfileY(sx));
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = stagePal.roadTop;
  ctx.fill();

  // Deeper sub-soil band
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 4) {
    ctx.lineTo(sx, roadProfileY(sx) + 18);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = stagePal.roadMid;
  ctx.fill();

  // Clean, simple, unmistakable craters: the road surface simply drops into a deep shadowed
  // chasm with zero distracting edge boxes or text!
  // Bright surface turf/crust lip ONLY on intact road segments (breaks cleanly at craters!)
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = stagePal.roadLip;
  ctx.beginPath();
  let penDown = false;
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    const wx = camX + sx;
    const inCrater = craters.some((c) => wx > c.x + 1 && wx < c.x + c.width - 1);
    if (inCrater) {
      penDown = false;
    } else {
      const y = roadProfileY(sx) + 1.5;
      if (!penDown) {
        ctx.moveTo(sx, y);
        penDown = true;
      } else {
        ctx.lineTo(sx, y);
      }
    }
  }
  ctx.stroke();

  // Subtle dark 1px top crisp edge along road & crater walls
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#181626';
  ctx.beginPath();
  for (let sx = 0; sx <= WORLD_WIDTH; sx += 2) {
    const y = roadProfileY(sx);
    if (sx === 0) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();

  // Subtle scrolling soil pebbles for speed sensation
  const pebbleShift = reducedMotion ? 0 : camX;
  ctx.fillStyle = 'rgba(24, 22, 38, 0.22)';
  for (let px = -((pebbleShift % 44 + 44) % 44); px < WORLD_WIDTH; px += 44) {
    const wx = camX + px;
    if (!craters.some((c) => wx >= c.x - 6 && wx <= c.x + c.width + 6)) {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates, sectorIdx);
      ctx.fillRect(Math.round(px), Math.round(gy + 9), 4, 2);
      ctx.fillRect(Math.round(px + 20), Math.round(gy + 21), 5, 2);
    }
  }
}

function drawGatesAndObstacles(ctx, state, reducedMotion) {
  const camX = state.cameraX;
  const sectorIdx = state.sectorIndex ?? 0;

  // Checkpoint beacons & Major Goal Arch
  for (const gate of state.course.gates) {
    const sx = Math.round(gate.x - camX);
    if (sx < -80 || sx > WORLD_WIDTH + 80) continue;
    const gy = groundYAt(gate.x, state.course.obstacles, state.course.gates, sectorIdx);

    if (gate.isMajor) {
      ctx.fillStyle = '#181626';
      ctx.fillRect(sx - 4, gy - 82, 5, 82);
      ctx.fillRect(sx + 50, gy - 82, 5, 82);

      ctx.fillStyle = gate.reached ? '#7be095' : '#ff8fab';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx - 10, gy - 104, 72, 24, 4);
      ctx.fill();
      ctx.stroke();

      for (let c = 0; c < 11; c++) {
        ctx.fillStyle = c % 2 === 0 ? '#181626' : '#fffdf4';
        ctx.fillRect(sx - 8 + c * 6, gy - 102, 6, 4);
      }
      ctx.fillStyle = '#181626';
      ctx.font = '900 12px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`GOAL ${gate.letter}`, sx + 26, gy - 87);
    } else {
      ctx.fillStyle = '#181626';
      ctx.fillRect(sx - 1, gy - 58, 3, 58);

      ctx.fillStyle = gate.reached ? '#8ce8a0' : '#ded4f1';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx + 2, gy - 58, 30, 21, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#181626';
      ctx.font = '900 12px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gate.reached ? `${gate.letter}✓` : gate.letter, sx + 17, gy - 43);
    }
  }

  const blink = !reducedMotion && Math.floor(state.elapsed * 9) % 2 === 0;

  for (const obs of state.course.obstacles) {
    if (obs.destroyed || obs.kind.startsWith('crater')) continue;
    const sx = obs.x - camX;
    if (sx + obs.width < -32 || sx > WORLD_WIDTH + 32) continue;
    const cx = sx + obs.width * 0.5;
    const gy = groundYAt(
      obs.x + obs.width * 0.5,
      state.course.obstacles,
      state.course.gates,
      sectorIdx,
    );

    if (obs.kind === 'mine') {
      // Slope-aligned, high-contrast proximity mine sitting ON TOP of the ground!
      const gyL = groundYAt(obs.x, state.course.obstacles, state.course.gates, sectorIdx);
      const gyR = groundYAt(
        obs.x + obs.width,
        state.course.obstacles,
        state.course.gates,
        sectorIdx,
      );
      const slopeAngle = Math.atan2(gyR - gyL, obs.width);

      ctx.save();
      ctx.translate(cx, gy);
      ctx.rotate(slopeAngle);

      // Dark outer halo + armored base plate above ground
      ctx.fillStyle = '#14111f';
      ctx.beginPath();
      ctx.moveTo(-12, 1);
      ctx.lineTo(-10, -8);
      ctx.lineTo(10, -8);
      ctx.lineTo(12, 1);
      ctx.closePath();
      ctx.fill();

      // Metallic steel body
      ctx.fillStyle = '#6c758c';
      ctx.fillRect(-9, -6, 18, 5);
      ctx.fillStyle = '#adb6cc';
      ctx.fillRect(-7, -6, 14, 2);

      // Crimson armed dome
      ctx.fillStyle = '#e62e5c';
      ctx.strokeStyle = '#14111f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -6, 6.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Three tall vertical contact spikes + bright beacon tips rising well above horizon!
      for (const pxOff of [-6, 0, 6]) {
        const spikeH = pxOff === 0 ? -16 : -13;
        ctx.fillStyle = '#14111f';
        ctx.fillRect(pxOff - 1.5, spikeH, 3, -spikeH - 5);
        ctx.fillStyle = blink ? '#fffdf4' : '#ffd15c';
        ctx.fillRect(pxOff - 1.5, spikeH - 2, 3, 3);
      }

      // Center warning core
      ctx.fillStyle = blink ? '#ffd15c' : '#fffdf4';
      ctx.fillRect(-2, -10, 4, 3);

      ctx.restore();
      continue;
    }

    // Angular, multi-faceted craggy lunar boulders (`rock-small` & `rock-tall`)
    const w = obs.width;
    const h = obs.height;
    const left = sx;
    const top = gy - h;

    ctx.save();
    // Main boulder silhouette
    ctx.beginPath();
    ctx.moveTo(left + 1, gy + 1);
    ctx.lineTo(left - 1, top + h * 0.58);
    ctx.lineTo(left + w * 0.18, top + h * 0.2);
    ctx.lineTo(left + w * 0.46, top);
    ctx.lineTo(left + w * 0.82, top + h * 0.16);
    ctx.lineTo(left + w + 1, top + h * 0.55);
    ctx.lineTo(left + w - 1, gy + 1);
    ctx.closePath();
    ctx.fillStyle = obs.kind === 'rock-tall' ? '#917ec2' : '#b5a6db';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#181626';
    ctx.stroke();

    // Sunlit upper-left facet
    ctx.beginPath();
    ctx.moveTo(left + 2, top + h * 0.56);
    ctx.lineTo(left + w * 0.2, top + h * 0.22);
    ctx.lineTo(left + w * 0.46, top + 2);
    ctx.lineTo(left + w * 0.52, top + h * 0.44);
    ctx.closePath();
    ctx.fillStyle = '#e8e0fa';
    ctx.fill();

    // Deep right shadow facet
    ctx.beginPath();
    ctx.moveTo(left + w * 0.52, top + h * 0.44);
    ctx.lineTo(left + w * 0.8, top + h * 0.18);
    ctx.lineTo(left + w - 1, top + h * 0.56);
    ctx.lineTo(left + w - 2, gy);
    ctx.lineTo(left + w * 0.44, gy);
    ctx.closePath();
    ctx.fillStyle = '#5a4a85';
    ctx.fill();

    // Internal crag line
    ctx.strokeStyle = '#2d2445';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.46, top + 2);
    ctx.lineTo(left + w * 0.52, top + h * 0.46);
    ctx.lineTo(left + w * 0.34, gy - 2);
    ctx.stroke();

    // Glowing fracture crack when 2-HP tall boulder has taken 1 hit
    if (obs.hp < obs.maxHp) {
      ctx.strokeStyle = '#ff3b6b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(left + w * 0.48, top + 2);
      ctx.lineTo(left + w * 0.34, top + h * 0.45);
      ctx.lineTo(left + w * 0.62, top + h * 0.72);
      ctx.lineTo(left + w * 0.45, gy - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Tumbling 8-sided highland rolling stones (Stages 4 & 5)
  for (const stone of state.rollingStones ?? []) {
    const sx = stone.x - camX;
    const sy = stone.y - stone.radius;
    const r = stone.radius;

    ctx.save();
    ctx.translate(sx, sy);
    if (!reducedMotion) {
      ctx.rotate(-stone.phase);
    }

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.86;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = stone.hp < stone.maxHp ? '#ff9776' : '#e6b85c';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#181626';
    ctx.stroke();

    // Facet cross lines so spin is unmistakable
    ctx.strokeStyle = '#8c6223';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.2);
    ctx.lineTo(r * 0.5, r * 0.3);
    ctx.moveTo(r * 0.2, -r * 0.6);
    ctx.lineTo(-r * 0.3, r * 0.5);
    ctx.stroke();

    ctx.restore();
  }
}

function drawRoverAndMona(ctx, state, reducedMotion) {
  if (state.invulnTimer > 0 && Math.floor(state.invulnTimer * 12) % 2 === 1) {
    return;
  }

  const bx = state.buggy.screenX;
  const by = state.buggy.y;
  const sectorIdx = state.sectorIndex ?? 0;

  // Match terrain slope smoothly when grounded!
  let tilt = state.buggy.pitch;
  if (state.buggy.grounded) {
    const yL = groundYAt(
      state.buggy.worldX - 18,
      state.course.obstacles,
      state.course.gates,
      sectorIdx,
    );
    const yR = groundYAt(
      state.buggy.worldX + 18,
      state.course.obstacles,
      state.course.gates,
      sectorIdx,
    );
    tilt = Math.atan2(yR - yL, 36) * 0.85;
  }

  const animFrame = reducedMotion ? 0 : Math.floor(state.buggy.wheelPhase * 0.65) % 2;

  ctx.save();
  ctx.translate(Math.round(bx), Math.round(by));
  if (!reducedMotion) {
    ctx.rotate(tilt);
  }

  // 1. Boost thruster flame
  if (state.gearIndex === 2 && state.status === 'playing') {
    const fl = animFrame === 0 ? 15 : 10;
    ctx.fillStyle = '#ffd15c';
    ctx.strokeStyle = '#181626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-31, -15);
    ctx.lineTo(-31 - fl, -19);
    ctx.lineTo(-28 - fl * 0.6, -13);
    ctx.lineTo(-31 - fl, -9);
    ctx.lineTo(-31, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 2. Fine-pixel canonical Mona seated openly above the buggy fender!
  drawPixelSprite1x(ctx, animFrame === 0 ? MONA_FINE_A : MONA_FINE_B, -16, -39, {
    k: '#231f2e',
    i: '#fffdf4',
    w: '#ffffff',
    c: '#ffb3a7',
    q: '#70d6ff',
  });

  // 3. Rear anti-air plasma turret
  ctx.fillStyle = '#70d6ff';
  ctx.strokeStyle = '#181626';
  ctx.lineWidth = 1.8;
  ctx.fillRect(-26, -27, 7, 9);
  ctx.strokeRect(-26, -27, 7, 9);
  ctx.fillStyle = '#5ce0a8';
  ctx.fillRect(-24, -31, 3, 4);

  // 4. Sleek retro arcade pink & lavender 6-wheel buggy hull
  ctx.fillStyle = '#f06aa7';
  ctx.strokeStyle = '#181626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-31, -18);
  ctx.lineTo(18, -18);
  ctx.lineTo(31, -13);
  ctx.lineTo(31, -8);
  ctx.lineTo(-31, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Highlight trim & side pod
  ctx.fillStyle = '#ffb3d1';
  ctx.fillRect(-28, -17, 44, 2.5);
  ctx.fillStyle = '#ded4f1';
  ctx.fillRect(-15, -13.5, 32, 3.5);

  // 5. Front laser blaster
  ctx.fillStyle = '#ffd15c';
  ctx.fillRect(30, -15, 6, 5);
  ctx.strokeRect(30, -15, 6, 5);
  ctx.fillStyle = '#ff3366';
  ctx.fillRect(36, -14, 3, 3);

  // 6. Three articulated suspension struts & spoked arcade tires
  for (const [idx, wxOff] of [-20, 0, 20].entries()) {
    const bounce =
      reducedMotion || !state.buggy.grounded
        ? 0
        : Math.sin(state.buggy.wheelPhase + idx * 1.9) * 1.8;
    const wy = -6.5 + bounce;

    // Silver suspension strut
    ctx.strokeStyle = '#cfd6e6';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(wxOff * 0.82, -9);
    ctx.lineTo(wxOff, wy);
    ctx.stroke();

    // Rubber tire
    ctx.fillStyle = '#1e1b29';
    ctx.strokeStyle = '#0e0c14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wxOff, wy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating 4-spoke rim
    const spokeAngle = reducedMotion ? 0 : state.buggy.wheelPhase * 0.45 + idx;
    ctx.strokeStyle = '#fffdf4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(wxOff + Math.cos(spokeAngle) * 3.6, wy + Math.sin(spokeAngle) * 3.6);
    ctx.lineTo(wxOff - Math.cos(spokeAngle) * 3.6, wy - Math.sin(spokeAngle) * 3.6);
    ctx.moveTo(wxOff - Math.sin(spokeAngle) * 3.6, wy + Math.cos(spokeAngle) * 3.6);
    ctx.lineTo(wxOff + Math.sin(spokeAngle) * 3.6, wy - Math.cos(spokeAngle) * 3.6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDistinctUfosAndProjectiles(ctx, state, reducedMotion) {
  const camX = state.cameraX;

  // Player laser & anti-air plasma bolts
  for (const shot of state.shots) {
    const sx = shot.x - camX;
    const sy = shot.y;
    if (shot.kind === 'forward') {
      ctx.fillStyle = '#ff2e63';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(sx - 9, sy - 2.5, 18, 5, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(sx - 5, sy - 1, 10, 2);
    } else {
      ctx.fillStyle = '#56e0ff';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(sx - 2.5, sy - 9, 5, 16, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(sx - 1, sy - 6, 2, 10);
    }
  }

  const pulse = reducedMotion ? 0 : Math.sin(state.elapsed * 10);

  // Two unmistakably distinct UFO designs!
  for (const ufo of state.ufos) {
    const ux = ufo.screenX;
    const uy = ufo.y;
    const isCve = ufo.kind === 'cve-bomber' || ufo.kind === 'bomber';

    ctx.save();
    ctx.translate(ux, uy);

    if (isCve) {
      // TYPE 2: Heavy Crimson-and-Gold Horned CVE Dreadnought Saucer
      const hovering = (ufo.hoverTimer ?? 0) > 0;

      // Twin armored horns
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -7);
      ctx.lineTo(-16, -15);
      ctx.moveTo(10, -7);
      ctx.lineTo(16, -15);
      ctx.stroke();
      ctx.strokeStyle = '#ffd15c';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Golden armored command dome
      ctx.fillStyle = '#ffd15c';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -3, 11, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wide crimson dreadnought hull
      ctx.fillStyle = '#e02856';
      ctx.beginPath();
      ctx.ellipse(0, 1, 22, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Chasing rim lights
      const chase = reducedMotion ? 0 : Math.floor(state.elapsed * 8) % 4;
      for (let l = 0; l < 4; l++) {
        const lx = -12 + l * 8;
        ctx.fillStyle = l === chase ? '#fffdf4' : '#ffd15c';
        ctx.beginPath();
        ctx.arc(lx, 1, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Underneath CVE bomb-bay hatch (flashes bright white-gold during hover telegraph!)
      ctx.fillStyle = hovering ? '#fffdf4' : '#8f1535';
      ctx.beginPath();
      ctx.roundRect(-6, 6, 12, hovering ? 6 : 4, 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // TYPE 1: Agile Electric-Cyan Tri-Orb Bug-Dropper Cluster (classic tri-sphere silhouette!)
      // Subtle bank angle matching swoop direction
      if (!reducedMotion) {
        ctx.rotate((ufo.dir ?? 1) * 0.08);
      }

      // Energy triangle struts connecting the 3 orbs
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-11, 5);
      ctx.lineTo(11, 5);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = '#96f2ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Three glowing cyan plasma orbs (`top`, `bottom-left`, `bottom-right`)
      for (const [ox, oy] of [
        [0, -8],
        [-11, 5],
        [11, 5],
      ]) {
        ctx.fillStyle = '#3dc8ff';
        ctx.strokeStyle = '#181626';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(ox, oy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner pulsing white core
        ctx.fillStyle = pulse > 0 ? '#fffdf4' : '#bdf4ff';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Falling Bugs (winged fluttering bug) vs CVE Warheads (finned red/gold crater bomb)
  const wingFlap = !reducedMotion && Math.floor(state.elapsed * 14) % 2 === 0;
  for (const bomb of state.bombs) {
    const sx = bomb.x - camX;
    const sy = bomb.y;
    const isCve = bomb.kind === 'cve' || Boolean(bomb.carvesCrater);

    ctx.save();
    ctx.translate(sx, sy);

    if (isCve) {
      // Finned CVE crater-blasting warhead
      ctx.fillStyle = '#ffd15c';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(6, -8);
      ctx.lineTo(3, -3);
      ctx.lineTo(-3, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e02856';
      ctx.beginPath();
      ctx.ellipse(0, 1, 5.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = wingFlap ? '#fffdf4' : '#ffd15c';
      ctx.fillRect(-2, -1, 4, 3);
    } else {
      // Fluttering space-bug (explodes on contact, no crater)
      ctx.fillStyle = '#bdf4ff';
      ctx.strokeStyle = '#181626';
      ctx.lineWidth = 1.4;
      const wy = wingFlap ? -3 : 1;
      ctx.beginPath();
      ctx.ellipse(-6, wy, 5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(6, wy, 5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff6ea8';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // Retro spark & debris particles
  for (const p of state.particles) {
    const sx = p.x - camX;
    const sy = p.y;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle =
      p.colorKind === 'ruby'
        ? '#ff3b6b'
        : p.colorKind === 'lavender'
          ? '#ded4f1'
          : p.colorKind === 'mint'
            ? '#70d6ff'
            : '#ffd15c';
    ctx.strokeStyle = '#181626';
    ctx.lineWidth = 1.2;
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.strokeRect(sx - 3, sy - 3, 6, 6);
    ctx.restore();
  }
}

function drawRetroHudBezel(ctx, state, dark) {
  const hudBg = dark ? 'rgba(22, 20, 36, 0.92)' : 'rgba(255, 253, 244, 0.92)';
  const border = dark ? '#8b84a8' : '#2b2835';
  const textCol = dark ? '#f7f3e8' : '#231f2e';

  // Active UFO warning pill in upper-left
  if (state.ufos.length > 0) {
    const hasCve = state.ufos.some((u) => u.kind === 'cve-bomber' || ufoIsCve(u));
    ctx.fillStyle = hasCve ? '#ffd15c' : '#96f2ff';
    ctx.strokeStyle = '#181626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(12, 10, 158, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#181626';
    ctx.font = '800 11px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      hasCve ? `▲ CVE + BUG UFO (${state.ufos.length})` : `▲ BUG SCOUTS (${state.ufos.length})`,
      20,
      25,
    );
  }

  // Speed gear indicator in upper-right
  const gear = GEARS[state.gearIndex];
  ctx.fillStyle = hudBg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(WORLD_WIDTH - 128, 10, 116, 22, 6);
  ctx.fill();
  ctx.stroke();

  for (let g = 0; g < 3; g++) {
    ctx.fillStyle = g <= state.gearIndex ? '#5ce0a8' : 'rgba(130, 125, 150, 0.28)';
    ctx.strokeStyle = '#181626';
    ctx.lineWidth = 1.4;
    ctx.fillRect(WORLD_WIDTH - 120 + g * 11, 15, 8, 12);
    ctx.strokeRect(WORLD_WIDTH - 120 + g * 11, 15, 8, 12);
  }
  ctx.fillStyle = textCol;
  ctx.font = '800 11px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(gear.label, WORLD_WIDTH - 82, 25);

  // Bottom checkpoint progress radar strip
  const barX = 20;
  const barY = 330;
  const barW = WORLD_WIDTH - 40;
  ctx.fillStyle = hudBg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, 22, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textCol;
  ctx.font = '800 10.5px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.course.sectorName.toUpperCase(), barX + 10, barY + 15);

  const letters = sectorCheckpointLetters(state.checkpointIndex);
  const trackLeft = barX + 82;
  const trackRight = barX + barW - 20;
  const trackW = trackRight - trackLeft;
  const ratio = Math.max(0, Math.min(1, state.buggy.worldX / Math.max(1, state.course.length)));

  ctx.fillStyle = 'rgba(130, 125, 150, 0.35)';
  ctx.fillRect(trackLeft, barY + 9.5, trackW, 3);
  ctx.fillStyle = '#4ea870';
  ctx.fillRect(trackLeft, barY + 9.5, trackW * ratio, 3);

  letters.forEach((letter, idx) => {
    const lx = trackLeft + (trackW * idx) / Math.max(1, letters.length - 1);
    const reached = state.course.gates[idx]?.reached;
    ctx.fillStyle = reached ? '#7be095' : '#fffdf4';
    ctx.strokeStyle = '#181626';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(lx, barY + 11, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#181626';
    ctx.font = '800 9.5px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(letter, lx, barY + 14.5);
  });

  const markerX = trackLeft + trackW * ratio;
  ctx.fillStyle = '#ff2e63';
  ctx.beginPath();
  ctx.moveTo(markerX, barY + 3);
  ctx.lineTo(markerX - 4, barY - 2);
  ctx.lineTo(markerX + 4, barY - 2);
  ctx.closePath();
  ctx.fill();
}

function ufoIsCve(u) {
  return u.kind === 'cve-bomber' || u.kind === 'bomber';
}

export function renderGame(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dark = options.theme === 'dark';
  const reducedMotion = Boolean(options.reducedMotion);
  const sectorIdx = Math.max(0, Math.min(STAGE_THEMES.length - 1, state.sectorIndex ?? 0));
  const stagePal = dark ? STAGE_THEMES[sectorIdx].dark : STAGE_THEMES[sectorIdx].light;

  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const targetW = Math.round(WORLD_WIDTH * dpr);
  const targetH = Math.round(WORLD_HEIGHT * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  if (state.status === 'crashing' && !reducedMotion) {
    const mag = state.crashTimer * 5;
    ctx.translate(Math.sin(state.crashTimer * 55) * mag, Math.cos(state.crashTimer * 42) * mag);
  }

  drawSkyAndParallax(ctx, state, stagePal, reducedMotion, dark);
  drawRoadAndSimpleCraters(ctx, state, stagePal, reducedMotion);
  drawGatesAndObstacles(ctx, state, reducedMotion);
  if (state.status !== 'crashing' || state.crashTimer > 0.35) {
    drawRoverAndMona(ctx, state, reducedMotion);
  }
  drawDistinctUfosAndProjectiles(ctx, state, reducedMotion);
  drawRetroHudBezel(ctx, state, dark);

  ctx.restore();
}
