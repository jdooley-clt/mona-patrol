// 2D Canvas renderer for Mona Patrol — original vector & pixel sprites in the
// Commit Cabinet's pastel ivory, lavender, mint, coral, and graphite palette.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GROUND_Y,
  GEARS,
  groundYAt,
  sectorCheckpointLetters,
} from './engine.js';

const PALETTES = {
  light: {
    skyTop: '#f7f4e9',
    skyBottom: '#efe9dc',
    dot: '#ddd5c3',
    mesaFill: '#ded4f1',
    mesaShade: '#cbbce6',
    ridgeFill: '#c5e7d8',
    ridgeShade: '#a7d6c2',
    roadSurface: '#ece5f8',
    roadSub: '#d8cde9',
    roadDeep: '#c5b6de',
    craterBg: '#e4dccf',
    ink: '#2b2835',
    ivory: '#fffdf4',
    lavender: '#ded4f1',
    lavenderDeep: '#533e7d',
    mint: '#c5e7d8',
    commit: '#4ea870',
    coral: '#ffb7a5',
    ruby: '#9e1940',
    gold: '#f5cc66',
    radarBg: 'rgba(255, 253, 244, 0.88)',
  },
  dark: {
    skyTop: '#22202b',
    skyBottom: '#2c2838',
    dot: '#3a3548',
    mesaFill: '#3e3554',
    mesaShade: '#332b46',
    ridgeFill: '#2f4d43',
    ridgeShade: '#264037',
    roadSurface: '#3b344d',
    roadSub: '#302a40',
    roadDeep: '#262134',
    craterBg: '#1b1824',
    ink: '#f4efe2',
    ivory: '#fffdf4',
    lavender: '#6d5c94',
    lavenderDeep: '#dcd0fa',
    mint: '#4b7d6b',
    commit: '#67c98c',
    coral: '#ff9d87',
    ruby: '#ff7b9c',
    gold: '#f7d274',
    radarBg: 'rgba(34, 32, 43, 0.9)',
  },
};

// 12x10 pixel Mona head + torso in cockpit (k=dark ink, i=ivory, c=coral blush, m=mint visor)
const MONA_SPRITE = [
  '.kk......kk.',
  '.kkk....kkk.',
  '.kkkkkkkkkk.',
  'kkiiiiiiiikk',
  'kiikkiikkiik',
  'kiikkiikkiik',
  'kiciiiiiicik',
  'kkkkkkkkkkkk',
  '.kkmmmmmmkk.',
  '..kkkkkkkk..',
];

function drawPixelMap(ctx, map, x, y, scale, colors) {
  for (let row = 0; row < map.length; row++) {
    const line = map[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(Math.round(x + col * scale), Math.round(y + row * scale), scale, scale);
    }
  }
}

function drawSkyAndParallax(ctx, state, pal, reducedMotion) {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Subtle blueprint star/dot grid
  const starScroll = reducedMotion ? 0 : (state.cameraX * 0.06) % 32;
  ctx.fillStyle = pal.dot;
  for (let sx = -starScroll; sx < WORLD_WIDTH; sx += 32) {
    for (let sy = 18; sy < GROUND_Y - 70; sy += 32) {
      ctx.fillRect(Math.round(sx), sy, 2, 2);
    }
  }

  // Twinkling constellation crosses
  ctx.fillStyle = pal.ivory;
  const stars = [
    [84, 42],
    [224, 30],
    [388, 52],
    [542, 36],
  ];
  for (const [bx, by] of stars) {
    const px = ((bx - (reducedMotion ? 0 : state.cameraX * 0.04)) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH;
    ctx.fillRect(px - 4, by, 9, 2);
    ctx.fillRect(px, by - 4, 2, 9);
  }

  // Far lunar mesas (lavender)
  const farOffset = reducedMotion ? 0 : state.cameraX * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= WORLD_WIDTH; x += 8) {
    const wx = x + farOffset;
    const h = 196 + Math.sin(wx * 0.0065) * 28 + Math.cos(wx * 0.014) * 14;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(WORLD_WIDTH, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = pal.mesaFill;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mid repository ridges + commit beacons (mint)
  const midOffset = reducedMotion ? 0 : state.cameraX * 0.36;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= WORLD_WIDTH; x += 8) {
    const wx = x + midOffset;
    const h = 236 + Math.sin(wx * 0.011 + 1.2) * 18 + Math.cos(wx * 0.025) * 8;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(WORLD_WIDTH, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = pal.ridgeFill;
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Distant branch towers along mid ridge
  const towerSpacing = 220;
  const firstTower = Math.floor(midOffset / towerSpacing) * towerSpacing;
  for (let tx = firstTower; tx < midOffset + WORLD_WIDTH + towerSpacing; tx += towerSpacing) {
    const sx = tx - midOffset;
    const baseH = 236 + Math.sin(tx * 0.011 + 1.2) * 18 + Math.cos(tx * 0.025) * 8;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, baseH);
    ctx.lineTo(sx, baseH - 18);
    ctx.stroke();
    ctx.fillStyle = pal.commit;
    ctx.beginPath();
    ctx.arc(sx, baseH - 21, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawTerrainAndCraters(ctx, state, pal) {
  const camX = state.cameraX;
  const craters = state.course.obstacles.filter(
    (o) =>
      o.kind.startsWith('crater') &&
      o.x + o.width >= camX - 40 &&
      o.x <= camX + WORLD_WIDTH + 40,
  );

  // Fill lunar crust polygon with jagged merge-conflict chasms
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);

  let x = 0;
  while (x <= WORLD_WIDTH) {
    const wx = camX + x;
    const crater = craters.find((c) => wx >= c.x && wx <= c.x + c.width);
    if (crater) {
      const leftScreen = crater.x - camX;
      const rightScreen = crater.x + crater.width - camX;
      const midScreen = (leftScreen + rightScreen) * 0.5;
      const depth = crater.kind === 'crater-wide' ? 40 : 32;
      ctx.lineTo(leftScreen, GROUND_Y);
      ctx.lineTo(leftScreen + crater.width * 0.22, GROUND_Y + depth * 0.72);
      ctx.lineTo(midScreen, GROUND_Y + depth);
      ctx.lineTo(rightScreen - crater.width * 0.22, GROUND_Y + depth * 0.68);
      ctx.lineTo(rightScreen, GROUND_Y);
      x = Math.max(x + 4, Math.ceil(rightScreen));
    } else {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates);
      ctx.lineTo(x, gy);
      x += 6;
    }
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = pal.roadSurface;
  ctx.fill();

  // Sub-surface regolith band
  ctx.fillStyle = pal.roadSub;
  ctx.fillRect(0, GROUND_Y + 18, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y - 18);

  // Outline road top & decorate craters with non-color-only conflict markers
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  x = 0;
  let started = false;
  while (x <= WORLD_WIDTH) {
    const wx = camX + x;
    const crater = craters.find((c) => wx >= c.x && wx <= c.x + c.width);
    if (crater) {
      const leftScreen = crater.x - camX;
      const rightScreen = crater.x + crater.width - camX;
      const midScreen = (leftScreen + rightScreen) * 0.5;
      const depth = crater.kind === 'crater-wide' ? 40 : 32;
      ctx.lineTo(leftScreen, GROUND_Y);
      ctx.lineTo(leftScreen + crater.width * 0.22, GROUND_Y + depth * 0.72);
      ctx.lineTo(midScreen, GROUND_Y + depth);
      ctx.lineTo(rightScreen - crater.width * 0.22, GROUND_Y + depth * 0.68);
      ctx.lineTo(rightScreen, GROUND_Y);
      x = Math.max(x + 4, Math.ceil(rightScreen));
    } else {
      const gy = groundYAt(wx, state.course.obstacles, state.course.gates);
      if (!started) {
        ctx.moveTo(x, gy);
        started = true;
      } else {
        ctx.lineTo(x, gy);
      }
      x += 6;
    }
  }
  ctx.stroke();

  // Crater lip hazard posts & conflict chevrons (`<<<`)
  for (const crater of craters) {
    const lx = crater.x - camX;
    const rx = crater.x + crater.width - camX;
    for (const edgeX of [lx - 4, rx]) {
      ctx.fillStyle = pal.coral;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.fillRect(edgeX, GROUND_Y - 8, 6, 8);
      ctx.strokeRect(edgeX, GROUND_Y - 8, 6, 8);
    }
    ctx.fillStyle = pal.ruby;
    ctx.font = 'bold 10px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('<<<', (lx + rx) * 0.5, GROUND_Y + 15);
  }
}

function drawGatesAndObstacles(ctx, state, pal) {
  const camX = state.cameraX;

  // Checkpoint gates
  for (const gate of state.course.gates) {
    const sx = gate.x - camX;
    if (sx < -60 || sx > WORLD_WIDTH + 60) continue;
    const gy = groundYAt(gate.x, state.course.obstacles, state.course.gates);

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, gy);
    ctx.lineTo(sx, gy - 64);
    ctx.stroke();

    // Flag plate
    const flagW = gate.isMajor ? 42 : 34;
    ctx.fillStyle = gate.reached ? pal.mint : pal.lavender;
    ctx.fillRect(sx, gy - 64, flagW, 24);
    ctx.strokeRect(sx, gy - 64, flagW, 24);

    ctx.fillStyle = '#2b2835';
    ctx.font = '800 13px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(gate.ReachedLabel || (gate.reached ? `${gate.letter}✓` : gate.letter), sx + flagW * 0.5, gy - 47);
  }

  // Surface boulders & mines
  for (const obs of state.course.obstacles) {
    if (obs.destroyed || obs.kind.startsWith('crater')) continue;
    const sx = obs.x - camX;
    if (sx + obs.width < -20 || sx > WORLD_WIDTH + 20) continue;
    const gy = groundYAt(obs.x + obs.width * 0.5, state.course.obstacles, state.course.gates);

    if (obs.kind === 'mine') {
      const cx = sx + obs.width * 0.5;
      ctx.fillStyle = pal.coral;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.lineTo(sx + 4, gy - 10);
      ctx.lineTo(cx - 4, gy - 10);
      ctx.lineTo(cx, gy - 17);
      ctx.lineTo(cx + 4, gy - 10);
      ctx.lineTo(sx + obs.width - 4, gy - 10);
      ctx.lineTo(sx + obs.width, gy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2b2835';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, gy - 3);
      continue;
    }

    // Faceted lunar boulder (`rock-small` or `rock-tall`)
    const topY = gy - obs.height;
    ctx.fillStyle = obs.kind === 'rock-tall' ? pal.lavender : pal.ivory;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx + 2, gy);
    ctx.lineTo(sx, topY + obs.height * 0.45);
    ctx.lineTo(sx + obs.width * 0.28, topY);
    ctx.lineTo(sx + obs.width * 0.76, topY + 3);
    ctx.lineTo(sx + obs.width, topY + obs.height * 0.5);
    ctx.lineTo(sx + obs.width - 2, gy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Non-color damage crack when tall rock has taken 1 hit
    if (obs.hp < obs.maxHp) {
      ctx.strokeStyle = pal.ruby;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + obs.width * 0.45, topY + 2);
      ctx.lineTo(sx + obs.width * 0.35, topY + obs.height * 0.5);
      ctx.lineTo(sx + obs.width * 0.6, gy - 4);
      ctx.stroke();
    }
  }
}

function drawBuggy(ctx, state, pal, reducedMotion) {
  if (state.invulnTimer > 0 && Math.floor(state.invulnTimer * 12) % 2 === 1) {
    return;
  }
  const bx = state.buggy.screenX;
  const by = state.buggy.y;

  ctx.save();
  ctx.translate(bx, by - 14);
  if (!reducedMotion) {
    ctx.rotate(state.buggy.pitch);
  }

  // Boost exhaust plume
  if (state.gearIndex === 2 && state.status === 'playing') {
    ctx.fillStyle = pal.coral;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-27, 2);
    ctx.lineTo(-39, -3);
    ctx.lineTo(-35, 3);
    ctx.lineTo(-41, 7);
    ctx.lineTo(-27, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Upward anti-air turret on rollbar
  ctx.fillStyle = pal.commit;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.fillRect(-8, -18, 7, 8);
  ctx.strokeRect(-8, -18, 7, 8);

  // Pixel Mona in the open lunar cockpit
  drawPixelMap(ctx, MONA_SPRITE, -5, -25, 2, {
    k: '#2b2835',
    i: '#fffdf4',
    c: '#ffb7a5',
    m: '#c5e7d8',
  });

  // Translucent mint windscreen
  ctx.fillStyle = pal.mint;
  ctx.beginPath();
  ctx.moveTo(12, -14);
  ctx.lineTo(22, -4);
  ctx.lineTo(12, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Main buggy chassis
  ctx.fillStyle = '#6f5a9a';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-26, -5, 52, 12, 5);
  ctx.fill();
  ctx.stroke();

  // Lavender side stripe
  ctx.fillStyle = '#ded4f1';
  ctx.fillRect(-18, -2, 34, 4);

  // Forward coral laser cannon
  ctx.fillStyle = pal.coral;
  ctx.fillRect(23, -3, 8, 5);
  ctx.strokeRect(23, -3, 8, 5);

  // Three articulated suspension wheels
  for (const [idx, wx] of [-17, 0, 17].entries()) {
    const bounce =
      reducedMotion || !state.buggy.grounded
        ? 0
        : Math.sin(state.buggy.wheelPhase + idx * 1.7) * 1.6;
    const wy = 9 + bounce;

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx * 0.7, 5);
    ctx.lineTo(wx, wy);
    ctx.stroke();

    ctx.fillStyle = '#2b2835';
    ctx.beginPath();
    ctx.arc(wx, wy, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.ivory;
    ctx.beginPath();
    ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawAerialAndProjectiles(ctx, state, pal) {
  const camX = state.cameraX;

  // Player laser & plasma bolts
  for (const shot of state.shots) {
    const sx = shot.x - camX;
    if (shot.kind === 'forward') {
      ctx.fillStyle = pal.ruby;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.fillRect(sx - 8, shot.y - 2.5, 16, 5);
      ctx.strokeRect(sx - 8, shot.y - 2.5, 16, 5);
    } else {
      ctx.fillStyle = pal.commit;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.fillRect(sx - 2.5, shot.y - 8, 5, 14);
      ctx.strokeRect(sx - 2.5, shot.y - 8, 5, 14);
    }
  }

  // Overhead Bug UFO saucers
  for (const ufo of state.ufos) {
    const ux = ufo.screenX;
    const uy = ufo.y;

    ctx.save();
    ctx.translate(ux, uy);

    // Bug antennae
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(-11, -16);
    ctx.moveTo(6, -9);
    ctx.lineTo(11, -16);
    ctx.stroke();

    // Bug legs
    ctx.beginPath();
    for (const lx of [-12, -4, 4, 12]) {
      ctx.moveTo(lx, 6);
      ctx.lineTo(lx + (lx < 0 ? -3 : 3), 12);
    }
    ctx.stroke();

    // Mint dome
    ctx.fillStyle = pal.mint;
    ctx.beginPath();
    ctx.arc(0, -3, 11, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    // Saucer hull (coral for scout, gold-trimmed lavender for bomber)
    ctx.fillStyle = ufo.kind === 'bomber' ? pal.gold : pal.coral;
    ctx.beginPath();
    ctx.ellipse(0, 2, 21, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Portholes
    ctx.fillStyle = pal.ivory;
    for (const px of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.arc(px, 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Falling regression bombs
  for (const bomb of state.bombs) {
    const sx = bomb.x - camX;
    ctx.fillStyle = bomb.carvesCrater ? pal.gold : pal.coral;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, bomb.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 4, bomb.y - 5);
    ctx.lineTo(sx + 4, bomb.y - 5);
    ctx.lineTo(sx, bomb.y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Explosion & dust particles
  for (const p of state.particles) {
    const sx = p.x - camX;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal[p.colorKind] || pal.coral;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.fillRect(sx - 3, p.y - 3, 6, 6);
    ctx.strokeRect(sx - 3, p.y - 3, 6, 6);
    ctx.restore();
  }
}

function drawCanvasHudStrip(ctx, state, pal) {
  // Overhead UFO alert pill
  if (state.ufos.length > 0) {
    ctx.fillStyle = pal.coral;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, 12, 146, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b2835';
    ctx.font = '800 11px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`▲ BUGS OVERHEAD (${state.ufos.length})`, 24, 28);
  }

  // Gear pill in upper-right of sky
  const gear = GEARS[state.gearIndex];
  ctx.fillStyle = pal.radarBg;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(WORLD_WIDTH - 134, 12, 120, 24, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.font = '800 11px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  const bars = '▮'.repeat(state.gearIndex + 1) + '▯'.repeat(2 - state.gearIndex);
  ctx.fillText(`${bars} ${gear.label}`, WORLD_WIDTH - 74, 28);

  // Bottom sector checkpoint radar strip (`A — B — C — D — E`)
  const barX = 24;
  const barY = 326;
  const barW = WORLD_WIDTH - 48;
  ctx.fillStyle = pal.radarBg;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, 24, 8);
  ctx.fill();
  ctx.stroke();

  const letters = sectorCheckpointLetters(state.checkpointIndex);
  const trackLeft = barX + 58;
  const trackRight = barX + barW - 22;
  const trackW = trackRight - trackLeft;

  ctx.fillStyle = pal.ink;
  ctx.font = '800 10px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.course.sectorName.toUpperCase(), barX + 10, barY + 16);

  // Track line + progress fill
  const ratio = Math.max(0, Math.min(1, state.buggy.worldX / Math.max(1, state.course.length)));
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(trackLeft, barY + 12);
  ctx.lineTo(trackRight, barY + 12);
  ctx.stroke();

  ctx.strokeStyle = pal.commit;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(trackLeft, barY + 12);
  ctx.lineTo(trackLeft + trackW * ratio, barY + 12);
  ctx.stroke();

  letters.forEach((letter, idx) => {
    const lx = trackLeft + (trackW * idx) / Math.max(1, letters.length - 1);
    const reached = state.course.gates[idx]?.reached;
    ctx.fillStyle = reached ? pal.commit : pal.ivory;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(lx, barY + 12, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2b2835';
    ctx.font = '800 9px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(letter, lx, barY + 15.5);
  });

  // Live buggy marker on radar
  const markerX = trackLeft + trackW * ratio;
  ctx.fillStyle = pal.ruby;
  ctx.beginPath();
  ctx.moveTo(markerX, barY + 3);
  ctx.lineTo(markerX - 4, barY - 2);
  ctx.lineTo(markerX + 4, barY - 2);
  ctx.closePath();
  ctx.fill();
}

export function renderGame(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  const reducedMotion = Boolean(options.reducedMotion);
  const pal = PALETTES[theme];

  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const targetW = Math.round(WORLD_WIDTH * dpr);
  const targetH = Math.round(WORLD_HEIGHT * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Subtle crash shake only when reduced motion is off
  if (state.status === 'crashing' && !reducedMotion) {
    const mag = state.crashTimer * 6;
    ctx.translate(
      Math.sin(state.crashTimer * 55) * mag,
      Math.cos(state.crashTimer * 43) * mag,
    );
  }

  drawSkyAndParallax(ctx, state, pal, reducedMotion);
  drawTerrainAndCraters(ctx, state, pal);
  drawGatesAndObstacles(ctx, state, pal);
  if (state.status !== 'crashing' || state.crashTimer > 0.35) {
    drawBuggy(ctx, state, pal, reducedMotion);
  }
  drawAerialAndProjectiles(ctx, state, pal);
  drawCanvasHudStrip(ctx, state, pal);

  // Sector clear celebration banner on canvas
  if (state.status === 'sector-clear' && state.lastSectorBonus) {
    const b = state.lastSectorBonus;
    ctx.fillStyle = pal.radarBg;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(150, 86, 340, 114, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.font = '800 18px "Mona Sans", "Segoe UI", sans-serif';
    ctx.fillText(`CHECKPOINT ${b.letter} — SECTOR CLEAR!`, 320, 118);
    ctx.font = '700 13px ui-monospace, Consolas, monospace';
    ctx.fillText(`TIME ${b.seconds.toFixed(1)}s  (PAR ${b.parSeconds}s)`, 320, 148);
    ctx.fillStyle = pal.lavenderDeep;
    ctx.font = '800 15px ui-monospace, Consolas, monospace';
    ctx.fillText(`SECTOR BONUS +${b.bonus} PTS`, 320, 176);
  }

  ctx.restore();
}
