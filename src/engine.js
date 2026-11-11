// Pure, deterministic simulation for Mona Patrol (no DOM or Web Audio access).
// Five distinct stages (A–E, F–J, K–O, P–T, U–Z):
// - Stage 1 (A–E): Lunar Crater Ridge — approachable 90%+ clear rate, rocks & craters, intro UFOs
// - Stage 2 (F–J): Octo Metropolis — varied-speed Bug-Dropper & CVE Crater-Bomber UFOs, earlier drops
// - Stage 3 (K–O): Canary Minefield — tricky mine + crater + boulder skill combinations
// - Stage 4 (P–T): Highland Slopes — undulating hills with bouncing/rolling stones + aggressive UFOs
// - Stage 5 (U–Z): Omega Citadel — full arcade gauntlet combining all hazards and enemy types

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 360;
export const GROUND_Y = 284;
export const GRAVITY = 840;
export const JUMP_VELOCITY = -372;
export const SECTION_LENGTH = 1350;
export const PAR_SECONDS = 52;
export const EXTRA_LIFE_SCORE = 10_000;

export const CHECKPOINTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const SECTORS = [
  { name: 'main', themeTitle: 'Lunar Crater Ridge', start: 0, end: 4 },
  { name: 'release', themeTitle: 'Octo Metropolis', start: 5, end: 9 },
  { name: 'canary', themeTitle: 'Canary Minefield', start: 10, end: 14 },
  { name: 'hotfix', themeTitle: 'Rolling Highlands', start: 15, end: 19 },
  { name: 'omega', themeTitle: 'Omega Citadel', start: 20, end: 25 },
];

export const GEARS = [
  { id: 'slow', label: 'SLOW', speed: 125, screenX: 116 },
  { id: 'cruise', label: 'CRUISE', speed: 182, screenX: 150 },
  { id: 'fast', label: 'BOOST', speed: 244, screenX: 188 },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sectorIndexForCheckpoint(cpIndex) {
  const clamped = Math.max(0, Math.min(CHECKPOINTS.length - 1, cpIndex));
  const idx = SECTORS.findIndex((s) => clamped >= s.start && clamped <= s.end);
  return idx >= 0 ? idx : 0;
}

export function sectorForCheckpoint(cpIndex) {
  return SECTORS[sectorIndexForCheckpoint(cpIndex)];
}

export function sectorCheckpointLetters(cpIndex) {
  const sector = sectorForCheckpoint(cpIndex);
  return CHECKPOINTS.slice(sector.start, sector.end + 1);
}

export function createSectionStats() {
  return {
    shotsFired: 0,
    shotsHit: 0,
    ufosSpawned: 0,
    ufosDestroyed: 0,
    bugsDestroyed: 0,
    cvesIntercepted: 0,
    cratersCarved: 0,
    rocksDestroyed: 0,
    stonesDestroyed: 0,
    hazardsJumped: 0,
    crashes: 0,
  };
}

// Smooth fine-grained lunar ground profile. Stages 4–5 (sectorIndex >= 3) feature real
// highland hills & valleys while keeping checkpoint gates and crater rims level.
export function groundYAt(worldX, obstacles = [], gates = [], sectorIndex = 0) {
  for (const gate of gates) {
    if (Math.abs(worldX - gate.x) < 105) return GROUND_Y;
  }
  for (const obs of obstacles) {
    if (obs.kind.startsWith('crater') && worldX >= obs.x - 28 && worldX <= obs.x + obs.width + 28) {
      return GROUND_Y;
    }
  }
  if (sectorIndex >= 3) {
    const hill = Math.sin(worldX * 0.0068) * 14 + Math.cos(worldX * 0.015) * 6;
    let blend = 1;
    for (const gate of gates) {
      const dist = Math.abs(worldX - gate.x);
      if (dist < 220) {
        blend = Math.min(blend, Math.max(0, (dist - 105) / 115));
      }
    }
    return Math.round((GROUND_Y + hill * blend) * 2) / 2;
  }
  const raw = Math.sin(worldX * 0.012) * 2.5 + Math.cos(worldX * 0.027) * 1.3;
  return Math.round((GROUND_Y + raw) * 2) / 2;
}

function makeObstacle(kind, x) {
  const rx = Math.round(x);
  switch (kind) {
    case 'crater-small':
      return {
        kind,
        x: rx,
        width: 42,
        height: 26,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 100,
      };
    case 'crater-wide':
      return {
        kind,
        x: rx,
        width: 62,
        height: 32,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 150,
      };
    case 'rock-small':
      return {
        kind,
        x: rx,
        width: 26,
        height: 22,
        hp: 1,
        maxHp: 1,
        shootPoints: 100,
        jumpPoints: 80,
      };
    case 'rock-tall':
      return {
        kind,
        x: rx,
        width: 32,
        height: 32,
        hp: 2,
        maxHp: 2,
        shootPoints: 200,
        jumpPoints: 120,
      };
    case 'mine':
      return {
        kind,
        x: rx,
        width: 20,
        height: 14,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 150,
      };
    default:
      throw new Error(`Unknown obstacle kind: ${kind}`);
  }
}

// Deterministically builds one leg between `cpIndex` and `cpIndex + 1`.
export function generateCourseSection(cpIndex, seed = 2026, loop = 0) {
  const sectorIdx = sectorIndexForCheckpoint(cpIndex);
  const sector = SECTORS[sectorIdx];
  if (cpIndex >= sector.end) {
    return { obstacles: [], waves: [], stoneSpawns: [] };
  }
  const isFirstStage = sectorIdx === 0 && loop === 0;
  const legOffset = cpIndex - sector.start;
  const startX = legOffset * SECTION_LENGTH;
  const endX = (legOffset + 1) * SECTION_LENGTH;
  const rng = mulberry32(
    ((seed >>> 0) ^ Math.imul(cpIndex + 1, 0x9e3779b1) ^ Math.imul(loop + 1, 0x85ebca6b)) >>> 0,
  );

  const obstacles = [];
  const pushObs = (obs) => {
    obs.id = `${cpIndex}-${obstacles.length}`;
    obs.destroyed = false;
    obs.scored = false;
    obstacles.push(obs);
  };

  let cursor = startX + (cpIndex === 0 && loop === 0 ? 520 : isFirstStage ? 390 : 300);
  const safeEnd = endX - 250;

  while (cursor < safeEnd) {
    const roll = rng();

    if (isFirstStage) {
      // Stage 1 (A–E): approachable 90%+ clear tuning — shootable boulders & narrow craters
      if (roll < 0.52) {
        pushObs(makeObstacle('rock-small', cursor));
      } else if (roll < 0.82 || cpIndex < 2) {
        const c = makeObstacle('crater-small', cursor);
        c.width = cpIndex === 0 ? 38 : 42;
        pushObs(c);
      } else if (roll < 0.94) {
        pushObs(makeObstacle('rock-tall', cursor));
      } else {
        const cw = makeObstacle('crater-wide', cursor);
        cw.width = 52;
        pushObs(cw);
      }
      const last = obstacles[obstacles.length - 1];
      cursor = last.x + last.width + 355 + Math.round(rng() * 105);
      continue;
    }

    if (sectorIdx === 1) {
      // Stage 2 (F–J): Octo Metropolis — wider craters, 2-HP boulders, and rock-pair clusters
      if (roll < 0.3 && cursor + 150 < safeEnd) {
        // Skill cluster: small rock guarding a tall boulder right behind it
        const r1 = makeObstacle('rock-small', cursor);
        const r2 = makeObstacle('rock-tall', cursor + 64);
        pushObs(r1);
        pushObs(r2);
        cursor = r2.x + r2.width + 255 + Math.round(rng() * 80);
      } else if (roll < 0.58) {
        pushObs(makeObstacle('crater-wide', cursor));
        const last = obstacles[obstacles.length - 1];
        cursor = last.x + last.width + 250 + Math.round(rng() * 80);
      } else if (roll < 0.82) {
        pushObs(makeObstacle('rock-tall', cursor));
        const last = obstacles[obstacles.length - 1];
        cursor = last.x + last.width + 235 + Math.round(rng() * 75);
      } else {
        pushObs(makeObstacle('crater-small', cursor));
        const last = obstacles[obstacles.length - 1];
        cursor = last.x + last.width + 230 + Math.round(rng() * 75);
      }
      continue;
    }

    if (sectorIdx >= 2) {
      // Stage 3+ (K–O Canary Minefield, P–T Highlands, U–Z Citadel):
      // Deliberate tricky mine combinations requiring speed control + shoot-then-jump skill!
      if (roll < 0.28 && cursor + 180 < safeEnd) {
        // Combo 1: Twin spaced mines (BOOST jumps clean over both, or SLOW hops between them!)
        const m1 = makeObstacle('mine', cursor);
        const m2 = makeObstacle('mine', cursor + 96);
        pushObs(m1);
        pushObs(m2);
        cursor = m2.x + m2.width + 255 + Math.round(rng() * 75);
      } else if (roll < 0.54 && cursor + 190 < safeEnd) {
        // Combo 2: Boulder shielding a mine right behind it (shoot rock, then immediately jump mine!)
        const rock = makeObstacle(roll < 0.4 ? 'rock-tall' : 'rock-small', cursor);
        const mine = makeObstacle('mine', cursor + rock.width + 58);
        pushObs(rock);
        pushObs(mine);
        cursor = mine.x + mine.width + 250 + Math.round(rng() * 75);
      } else if (roll < 0.76 && cursor + 230 < safeEnd) {
        // Combo 3: Crater followed by a mine beyond the landing pad (demands jump timing & gear control!)
        const crater = makeObstacle('crater-small', cursor);
        const mine = makeObstacle('mine', cursor + crater.width + 138);
        pushObs(crater);
        pushObs(mine);
        cursor = mine.x + mine.width + 255 + Math.round(rng() * 70);
      } else if (roll < 0.9) {
        pushObs(makeObstacle('mine', cursor));
        const last = obstacles[obstacles.length - 1];
        cursor = last.x + last.width + 215 + Math.round(rng() * 70);
      } else {
        pushObs(makeObstacle('crater-wide', cursor));
        const last = obstacles[obstacles.length - 1];
        cursor = last.x + last.width + 250 + Math.round(rng() * 70);
      }
    }
  }

  // Ensure Stage 3 (K–O) ALWAYS features at least 2 mines per leg regardless of RNG seed
  if (sectorIdx === 2 && obstacles.filter((o) => o.kind === 'mine').length < 2) {
    const fallbackX = startX + SECTION_LENGTH - 320;
    if (!obstacles.some((o) => Math.abs(o.x - fallbackX) < 120)) {
      pushObs(makeObstacle('mine', fallbackX));
    }
  }

  // Rolling stone spawns on highland hills in Stages 4 & 5 (P–T and U–Z)
  const stoneSpawns = [];
  if (sectorIdx >= 3) {
    const stoneCount = sectorIdx >= 4 || loop > 0 ? 2 : 1;
    for (let s = 0; s < stoneCount; s++) {
      const triggerX = Math.round(startX + 360 + s * 440);
      if (triggerX < endX - 240) {
        stoneSpawns.push({
          id: `stone-${cpIndex}-${s}`,
          triggerX,
          spawned: false,
          rollSpeed: 82 + s * 18 + loop * 10,
          bounceVelocity: -195 - (s % 2) * 30,
        });
      }
    }
  }

  // Scheduled left-to-right UFO waves with escalating variety, speed variance, and drop timing
  const waves = [];
  const waveCount = isFirstStage ? 1 : sectorIdx >= 2 || loop > 0 ? 2 : legOffset >= 1 ? 2 : 1;

  for (let w = 0; w < waveCount; w++) {
    const triggerX = Math.round(startX + (isFirstStage ? 330 : 240) + w * 460);
    if (triggerX >= endX - 210) continue;

    const count = isFirstStage
      ? Math.min(3, 1 + Math.floor((cpIndex + 1) / 2))
      : Math.min(4, 2 + ((cpIndex + w + loop) % 2) + (sectorIdx >= 3 ? 1 : 0));

    // Build per-UFO roster mixing `bug-dropper` (swooping wave, drops exploding bugs)
    // and `cve-bomber` (stalk-and-hover strafe, drops crater-carving CVEs).
    // Majority enter from left; a small, increasing fraction enter from right as stages advance!
    const rightShareByStage = [0.15, 0.28, 0.35, 0.42, 0.46];
    const rightProb = rightShareByStage[Math.min(4, sectorIdx)] ?? 0.3;

    const ufoSpecs = [];
    for (let i = 0; i < count; i++) {
      let ufoKind = 'bug-dropper';
      if (isFirstStage) {
        if (cpIndex === 3 && i === count - 1) ufoKind = 'cve-bomber';
      } else if (sectorIdx === 1) {
        ufoKind = (i + w + legOffset) % 2 === 1 ? 'cve-bomber' : 'bug-dropper';
      } else {
        ufoKind = (i + w) % 2 === 0 ? 'cve-bomber' : 'bug-dropper';
      }

      // Entry side: majority from left; deterministic increasing right-side entries
      let enterFrom = 'left';
      if (isFirstStage) {
        if (cpIndex === 3 && i === count - 1) enterFrom = 'right';
      } else if (i > 0 && rng() < rightProb * 1.35) {
        enterFrom = 'right';
      } else if (sectorIdx >= 2 && w === 1 && i === count - 1) {
        enterFrom = 'right';
      }

      const speedRoll = rng();
      let passSpeed;
      let surgeAmp;
      if (isFirstStage) {
        passSpeed = 96 + i * 10 + cpIndex * 4;
        surgeAmp = 12 + cpIndex * 3;
      } else {
        const minSpd = 82;
        const maxSpd = 136 + sectorIdx * 14 + Math.min(30, loop * 12);
        passSpeed = Math.round(minSpd + speedRoll * (maxSpd - minSpd));
        surgeAmp = 18 + sectorIdx * 8;
      }

      const dropLead = isFirstStage
        ? 185 - cpIndex * 12
        : Math.max(52, 140 - sectorIdx * 24 - loop * 12 + Math.round(rng() * 30));

      const dropInterval =
        cpIndex === 0 && loop === 0
          ? 8.5
          : isFirstStage
            ? 4.6 - cpIndex * 0.25
            : Math.max(1.65, 3.3 - sectorIdx * 0.42 - loop * 0.2);

      const maxDrops =
        cpIndex === 0 && loop === 0
          ? 0
          : isFirstStage
            ? 2
            : 3 + sectorIdx;

      ufoSpecs.push({
        kind: ufoKind,
        enterFrom,
        passSpeed,
        surgeAmp,
        dropLead,
        dropInterval,
        dropsCount: maxDrops,
      });
    }

    waves.push({
      id: `wave-${cpIndex}-${w}`,
      triggerX,
      spawned: false,
      kind: ufoSpecs.some((u) => u.kind === 'cve-bomber') ? 'cve-bomber' : 'bug-dropper',
      count,
      ufoSpecs,
    });
  }

  return { obstacles, waves, stoneSpawns };
}

export function buildSectorCourse(sectorIndex, seed = 2026, loop = 0) {
  const clampedIdx = Math.max(0, Math.min(SECTORS.length - 1, sectorIndex));
  const sector = SECTORS[clampedIdx];
  const gates = [];
  const obstacles = [];
  const waves = [];
  const stoneSpawns = [];

  for (let cp = sector.start; cp <= sector.end; cp++) {
    const gateX = (cp - sector.start) * SECTION_LENGTH;
    gates.push({
      cpIndex: cp,
      letter: CHECKPOINTS[cp],
      x: gateX,
      isMajor: cp === sector.end,
      reached: cp === sector.start,
    });
    if (cp < sector.end) {
      const leg = generateCourseSection(cp, seed, loop);
      obstacles.push(...leg.obstacles);
      waves.push(...leg.waves);
      stoneSpawns.push(...leg.stoneSpawns);
    }
  }

  return {
    sectorIndex: clampedIdx,
    sectorName: sector.name,
    themeTitle: sector.themeTitle,
    startCp: sector.start,
    endCp: sector.end,
    length: (sector.end - sector.start) * SECTION_LENGTH,
    gates,
    obstacles,
    waves,
    stoneSpawns,
  };
}

export function createGameState(options = {}) {
  const seed = options.seed ?? 2026;
  const bestScore = options.bestScore ?? 0;
  const startSector = Math.max(0, Math.min(SECTORS.length - 1, options.sectorIndex ?? 0));
  const course = buildSectorCourse(startSector, seed, 0);
  const startCp = course.startCp;
  const startGround = groundYAt(0, course.obstacles, course.gates, startSector);

  return {
    status: 'ready', // 'ready' | 'playing' | 'paused' | 'crashing' | 'sector-clear' | 'gameover'
    seed,
    selectedSector: startSector,
    score: 0,
    bestScore,
    nextExtraLifeScore: EXTRA_LIFE_SCORE,
    lives: 3,
    loop: 0,
    sectorIndex: startSector,
    checkpointIndex: startCp,
    checkpointLetter: CHECKPOINTS[startCp],
    elapsed: 0,
    sectorElapsed: 0,
    distanceRemainder: 0,
    gearIndex: 1,
    speed: GEARS[1].speed,
    cameraX: 0 - GEARS[1].screenX,
    fireCooldown: 0,
    crashTimer: 0,
    crashReason: '',
    sectorBannerTimer: 0,
    lastSectorBonus: null,
    sectionStats: createSectionStats(),
    invulnTimer: 0,
    course,
    buggy: {
      worldX: 0,
      screenX: GEARS[1].screenX,
      y: startGround,
      vy: 0,
      grounded: true,
      fallingInCrater: null,
      jumpBuffer: 0,
      coyoteTimer: 0,
      wheelPhase: 0,
      pitch: 0,
    },
    shots: [],
    ufos: [],
    bombs: [], // `{ kind: 'bug' | 'cve', carvesCrater: boolean, ... }`
    rollingStones: [],
    particles: [],
    events: [],
    input: {
      accelerate: false,
      brake: false,
      jumpHeld: false,
      fireHeld: false,
    },
  };
}

function addScore(state, points) {
  if (points <= 0) return;
  state.score += points;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
  }
  while (state.score >= state.nextExtraLifeScore) {
    state.lives += 1;
    state.nextExtraLifeScore += EXTRA_LIFE_SCORE;
    state.events.push({ type: 'extra-life', lives: state.lives });
  }
}

export function selectStartSector(state, sectorIndex) {
  const clamped = Math.max(0, Math.min(SECTORS.length - 1, sectorIndex));
  state.selectedSector = clamped;
  if (state.status === 'ready') {
    const fresh = createGameState({
      seed: state.seed,
      bestScore: state.bestScore,
      sectorIndex: clamped,
    });
    Object.assign(state, fresh);
  }
  return state;
}

export function startGame(state, options = {}) {
  const sectorIndex = options.sectorIndex ?? state.selectedSector ?? 0;
  const fresh = createGameState({
    seed: options.seed ?? state.seed,
    bestScore: state.bestScore,
    sectorIndex,
  });
  Object.assign(state, fresh);
  state.status = 'playing';
  state.events.push({
    type: 'started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
    sectorIndex: state.sectorIndex,
  });
  return state;
}

export function togglePause(state, forcePause = false) {
  if (state.status === 'playing') {
    state.status = 'paused';
    state.input.accelerate = false;
    state.input.brake = false;
    state.input.jumpHeld = false;
    state.input.fireHeld = false;
    state.events.push({ type: 'paused' });
    return true;
  }
  if (!forcePause && state.status === 'paused') {
    state.status = 'playing';
    state.events.push({ type: 'resumed' });
    return true;
  }
  return false;
}

export function shiftGear(state, delta) {
  const next = Math.max(0, Math.min(GEARS.length - 1, state.gearIndex + delta));
  if (next !== state.gearIndex) {
    state.gearIndex = next;
    state.events.push({ type: 'gear', gear: GEARS[next].id });
  }
  return GEARS[state.gearIndex];
}

export function requestJump(state) {
  if (state.status !== 'playing') return false;
  if (state.buggy.grounded || state.buggy.coyoteTimer > 0) {
    state.buggy.vy = JUMP_VELOCITY;
    state.buggy.grounded = false;
    state.buggy.fallingInCrater = null;
    state.buggy.coyoteTimer = 0;
    state.buggy.jumpBuffer = 0;
    state.events.push({ type: 'jump' });
    return true;
  }
  state.buggy.jumpBuffer = 0.16;
  return false;
}

export function fireWeapons(state) {
  if (state.status !== 'playing' || state.fireCooldown > 0) return false;
  const forwardActive = state.shots.filter((s) => s.kind === 'forward').length;
  const upwardActive = state.shots.filter((s) => s.kind === 'upward').length;
  if (forwardActive >= 4 && upwardActive >= 4) return false;

  if (forwardActive < 4) {
    state.shots.push({
      kind: 'forward',
      x: state.buggy.worldX + 30,
      y: state.buggy.y - 16,
      vx: state.speed + 430,
      vy: 0,
      groundHug: state.buggy.grounded,
      maxX: state.buggy.worldX + 360,
    });
  }
  if (upwardActive < 4) {
    state.shots.push({
      kind: 'upward',
      x: state.buggy.worldX - 2,
      y: state.buggy.y - 34,
      vx: state.speed * 0.96,
      vy: -510,
      minY: 12,
    });
  }
  state.sectionStats.shotsFired += 1;
  state.fireCooldown = 0.17;
  state.events.push({ type: 'fire' });
  return true;
}

function spawnExplosion(state, x, y, colorKind = 'coral', count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 50 + (i % 3) * 38;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.45,
      maxLife: 0.45,
      colorKind,
    });
  }
}

export function triggerCrash(state, reason) {
  if (state.status !== 'playing' || state.invulnTimer > 0) return false;
  state.status = 'crashing';
  state.crashTimer = 0.85;
  state.crashReason = reason;
  state.sectionStats.crashes += 1;
  state.input.accelerate = false;
  state.input.brake = false;
  state.input.fireHeld = false;
  state.shots = [];
  spawnExplosion(state, state.buggy.worldX, state.buggy.y - 16, 'ruby', 16);
  state.events.push({ type: 'crash', reason, livesLeft: state.lives - 1 });
  return true;
}

function respawnAtCheckpoint(state) {
  const gate =
    state.course.gates.find((g) => g.cpIndex === state.checkpointIndex) ?? state.course.gates[0];
  const spawnX = gate.x;
  const gY = groundYAt(spawnX, state.course.obstacles, state.course.gates, state.sectorIndex);

  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = spawnX;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.fallingInCrater = null;
  state.buggy.pitch = 0;
  state.cameraX = spawnX - state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.rollingStones = [];
  state.invulnTimer = 2.0;

  for (const wave of state.course.waves) {
    if (wave.triggerX > spawnX + 120) wave.spawned = false;
  }
  for (const stSpawn of state.course.stoneSpawns ?? []) {
    if (stSpawn.triggerX > spawnX + 120) stSpawn.spawned = false;
  }
  state.status = 'playing';
  state.events.push({
    type: 'respawn',
    checkpoint: state.checkpointLetter,
    lives: state.lives,
  });
}

export function advanceToNextSector(state) {
  let nextSector = state.sectorIndex + 1;
  let nextLoop = state.loop;
  if (nextSector >= SECTORS.length) {
    nextSector = 0;
    nextLoop += 1;
  }
  state.sectorIndex = nextSector;
  state.selectedSector = nextSector;
  state.loop = nextLoop;
  state.course = buildSectorCourse(nextSector, state.seed, nextLoop);
  state.checkpointIndex = state.course.startCp;
  state.checkpointLetter = CHECKPOINTS[state.checkpointIndex];
  state.sectorElapsed = 0;
  state.lastSectorBonus = null;
  state.sectionStats = createSectionStats();

  const gY = groundYAt(0, state.course.obstacles, state.course.gates, nextSector);
  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = 0;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.fallingInCrater = null;
  state.buggy.pitch = 0;
  state.cameraX = -state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.rollingStones = [];
  state.invulnTimer = 1.2;
  state.status = 'playing';
  state.events.push({
    type: 'sector-started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
    sectorIndex: nextSector,
    loop: state.loop,
  });
}

export function replayCurrentSector(state) {
  const sector = state.sectorIndex;
  const loop = state.loop;
  state.course = buildSectorCourse(sector, state.seed, loop);
  state.checkpointIndex = state.course.startCp;
  state.checkpointLetter = CHECKPOINTS[state.checkpointIndex];
  state.sectorElapsed = 0;
  state.lastSectorBonus = null;
  state.sectionStats = createSectionStats();

  const gY = groundYAt(0, state.course.obstacles, state.course.gates, sector);
  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = 0;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.fallingInCrater = null;
  state.buggy.pitch = 0;
  state.cameraX = -state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.rollingStones = [];
  state.invulnTimer = 1.2;
  state.status = 'playing';
  state.events.push({
    type: 'sector-started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
    sectorIndex: sector,
    loop: state.loop,
  });
}

function normalizeUfoKind(kind) {
  if (kind === 'cve-bomber' || kind === 'bomber') return 'cve-bomber';
  return 'bug-dropper';
}

function spawnUfoWave(state, wave) {
  wave.spawned = true;
  const MAX_ACTIVE_UFOS = 5;
  const specs =
    wave.ufoSpecs ??
    Array.from({ length: wave.count }, (_, i) => ({
      kind: normalizeUfoKind(wave.kind),
      enterFrom: 'left',
      passSpeed: 98 + i * 8,
      surgeAmp: 14 + state.sectorIndex * 8,
      dropLead: Math.max(55, 190 - state.sectorIndex * 35),
      dropInterval: Math.max(1.7, 3.8 - state.sectorIndex * 0.45),
      dropsCount: 3,
    }));

  let leftCount = 0;
  let rightCount = 0;
  let spawnedBug = false;
  let spawnedCve = false;

  specs.forEach((spec, i) => {
    if (state.ufos.length >= MAX_ACTIVE_UFOS) return;
    const kind = normalizeUfoKind(spec.kind);
    const fromRight = spec.enterFrom === 'right';
    const startX = fromRight
      ? WORLD_WIDTH + 34 + rightCount * 68
      : -34 - leftCount * 68;
    if (fromRight) rightCount += 1;
    else leftCount += 1;

    if (kind === 'cve-bomber') spawnedCve = true;
    else spawnedBug = true;

    const minX = kind === 'cve-bomber' ? 74 : 52;
    const maxX = kind === 'cve-bomber' ? 470 : 430;
    const baseY = kind === 'cve-bomber' ? 54 + (i % 2) * 18 : 66 + (i % 3) * 18;

    state.ufos.push({
      id: `${wave.id}-ufo-${i}`,
      waveId: wave.id,
      kind,
      pattern: kind === 'cve-bomber' ? 'stalk-hover' : 'swoop-wave',
      enterFrom: fromRight ? 'right' : 'left',
      dir: fromRight ? -1 : 1,
      entered: false,
      minX,
      maxX,
      screenX: startX,
      passSpeed: spec.passSpeed,
      surgeAmp: spec.surgeAmp ?? 16,
      dropLead: spec.dropLead ?? 140,
      dropInterval: spec.dropInterval ?? 3.2,
      dropCooldown: 1.15 + i * 0.65,
      hoverTimer: 0,
      y: baseY,
      baseY,
      phase: i * 1.4,
      age: 0,
      bombsLeft: spec.dropsCount ?? 2,
      points: kind === 'cve-bomber' ? 300 : 200,
    });
    state.sectionStats.ufosSpawned += 1;
  });

  state.events.push({
    type: 'ufo-wave',
    kind: wave.kind,
    hasCve: spawnedCve,
    hasBugDropper: spawnedBug,
    count: leftCount + rightCount,
  });
}

function spawnRollingStone(state, spawnSpec) {
  spawnSpec.spawned = true;
  const spawnWorldX = state.cameraX + WORLD_WIDTH + 28;
  const gY = groundYAt(spawnWorldX, state.course.obstacles, state.course.gates, state.sectorIndex);
  state.rollingStones.push({
    id: spawnSpec.id,
    x: spawnWorldX,
    y: gY,
    vx: -(spawnSpec.rollSpeed ?? 90),
    vy: spawnSpec.bounceVelocity ?? -200,
    bounceVelocity: spawnSpec.bounceVelocity ?? -200,
    radius: 13,
    hp: 2,
    maxHp: 2,
    points: 250,
    phase: 0,
    scored: false,
  });
  state.events.push({ type: 'rolling-stone' });
}

function canCarveCraterAt(course, x) {
  for (const gate of course.gates) {
    if (Math.abs(x - gate.x) < 175) return false;
  }
  for (const obs of course.obstacles) {
    if (!obs.destroyed && x + 44 > obs.x - 155 && x < obs.x + obs.width + 155) {
      return false;
    }
  }
  return x > 220 && x < course.length - 220;
}

function stepParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

export function stepGame(state, dtRaw) {
  const dt = Math.min(0.05, Math.max(0, dtRaw));
  if (dt === 0) return state;

  if (state.status === 'crashing') {
    stepParticles(state, dt);
    state.crashTimer -= dt;
    if (state.crashTimer <= 0) {
      state.lives -= 1;
      if (state.lives <= 0) {
        state.lives = 0;
        state.status = 'gameover';
        state.events.push({
          type: 'gameover',
          score: state.score,
          bestScore: state.bestScore,
          checkpoint: state.checkpointLetter,
        });
      } else {
        respawnAtCheckpoint(state);
      }
    }
    return state;
  }

  if (state.status === 'sector-clear') {
    stepParticles(state, dt);
    if (state.sectorBannerTimer > 0) {
      state.sectorBannerTimer = Math.max(0, state.sectorBannerTimer - dt);
    }
    return state;
  }

  if (state.status !== 'playing') return state;

  state.elapsed += dt;
  state.sectorElapsed += dt;
  if (state.fireCooldown > 0) state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (state.invulnTimer > 0) state.invulnTimer = Math.max(0, state.invulnTimer - dt);
  if (state.buggy.jumpBuffer > 0) state.buggy.jumpBuffer = Math.max(0, state.buggy.jumpBuffer - dt);
  if (state.buggy.coyoteTimer > 0) {
    state.buggy.coyoteTimer = Math.max(0, state.buggy.coyoteTimer - dt);
  }

  if (state.input.fireHeld && state.fireCooldown <= 0) {
    fireWeapons(state);
  }

  const gear = GEARS[state.gearIndex];
  const holdDelta = (state.input.accelerate ? 18 : 0) - (state.input.brake ? 16 : 0);
  const targetSpeed = Math.max(98, gear.speed + holdDelta);

  if (state.buggy.grounded) {
    const accelRate = 440 * dt;
    if (state.speed < targetSpeed) state.speed = Math.min(targetSpeed, state.speed + accelRate);
    else if (state.speed > targetSpeed) state.speed = Math.max(targetSpeed, state.speed - accelRate);
  }

  const targetScreenX =
    gear.screenX + (state.input.accelerate ? 10 : 0) - (state.input.brake ? 10 : 0);
  state.buggy.screenX += (targetScreenX - state.buggy.screenX) * Math.min(1, dt * 6);

  const dx = state.speed * dt;
  state.buggy.worldX += dx;
  state.buggy.wheelPhase += dx * 0.14;
  state.cameraX = state.buggy.worldX - state.buggy.screenX;

  state.distanceRemainder += dx;
  while (state.distanceRemainder >= 100) {
    state.distanceRemainder -= 100;
    addScore(state, 10);
  }

  // Vertical rover physics & crater check
  const surfaceY = groundYAt(
    state.buggy.worldX,
    state.course.obstacles,
    state.course.gates,
    state.sectorIndex,
  );
  const overCrater = state.course.obstacles.find(
    (o) =>
      o.kind.startsWith('crater') &&
      state.buggy.worldX >= o.x + 6 &&
      state.buggy.worldX <= o.x + o.width - 6,
  );

  if (state.buggy.grounded) {
    if (overCrater) {
      state.buggy.grounded = false;
      state.buggy.fallingInCrater = overCrater.id;
      state.buggy.coyoteTimer = 0.05;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      } else {
        state.buggy.vy = 110;
      }
    } else {
      state.buggy.y = surfaceY;
      state.buggy.vy = 0;
      state.buggy.fallingInCrater = null;
      state.buggy.pitch = 0;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      }
    }
  } else {
    state.buggy.vy += GRAVITY * dt;
    state.buggy.y += state.buggy.vy * dt;
    state.buggy.pitch = Math.max(-0.2, Math.min(0.2, state.buggy.vy * 0.0005));

    // Driving into ANY crater without jumping crashes once the 50ms lip grace expires
    if (state.buggy.fallingInCrater && state.buggy.coyoteTimer <= 0) {
      state.buggy.fallingInCrater = null;
      triggerCrash(state, 'merge-conflict crater');
      return state;
    }

    // Jumping and landing inside a crater crashes on contact
    if (overCrater && state.buggy.vy > 0 && state.buggy.y >= surfaceY + 2 && state.buggy.coyoteTimer <= 0) {
      state.buggy.fallingInCrater = null;
      triggerCrash(state, 'merge-conflict crater');
      return state;
    }

    if (!overCrater && !state.buggy.fallingInCrater && state.buggy.y >= surfaceY) {
      state.buggy.y = surfaceY;
      state.buggy.vy = 0;
      state.buggy.grounded = true;
      state.buggy.pitch = 0;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      }
    }
  }

  // Spawn scheduled UFO waves & highland rolling stones
  for (const wave of state.course.waves) {
    if (!wave.spawned && state.buggy.worldX >= wave.triggerX) {
      spawnUfoWave(state, wave);
    }
  }
  for (const stSpawn of state.course.stoneSpawns ?? []) {
    if (!stSpawn.spawned && state.buggy.worldX >= stSpawn.triggerX) {
      spawnRollingStone(state, stSpawn);
    }
  }

  // Advance shots & test hits
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const shot = state.shots[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.kind === 'forward' && shot.groundHug) {
      shot.y =
        groundYAt(shot.x, state.course.obstacles, state.course.gates, state.sectorIndex) - 16;
    }

    if (
      (shot.kind === 'forward' &&
        (shot.x > shot.maxX || shot.x > state.cameraX + WORLD_WIDTH + 24)) ||
      (shot.kind === 'upward' && shot.y < shot.minY)
    ) {
      state.shots.splice(i, 1);
      continue;
    }

    let consumed = false;

    // Both forward and upward shots can shoot down falling Bugs and CVE warheads mid-air!
    for (let b = state.bombs.length - 1; b >= 0; b--) {
      const bomb = state.bombs[b];
      if (Math.abs(shot.x - bomb.x) <= 18 && Math.abs(shot.y - bomb.y) <= 18) {
        const isCve = bomb.kind === 'cve' || bomb.carvesCrater;
        const pts = isCve ? 150 : 100;
        state.bombs.splice(b, 1);
        consumed = true;
        state.sectionStats.shotsHit += 1;
        if (isCve) state.sectionStats.cvesIntercepted += 1;
        else state.sectionStats.bugsDestroyed += 1;
        addScore(state, pts);
        spawnExplosion(state, bomb.x, bomb.y, isCve ? 'gold' : 'mint', 10);
        state.events.push({ type: isCve ? 'cve-destroyed' : 'bomb-destroyed', points: pts });
        break;
      }
    }

    if (!consumed && shot.kind === 'forward') {
      // Check rolling stones first
      for (let rs = state.rollingStones.length - 1; rs >= 0; rs--) {
        const stone = state.rollingStones[rs];
        if (
          Math.abs(shot.x - stone.x) <= stone.radius + 10 &&
          shot.y >= stone.y - stone.radius * 2 - 10 &&
          shot.y <= stone.y + 14
        ) {
          stone.hp -= 1;
          consumed = true;
          state.sectionStats.shotsHit += 1;
          if (stone.hp <= 0) {
            state.rollingStones.splice(rs, 1);
            state.sectionStats.stonesDestroyed += 1;
            addScore(state, stone.points);
            spawnExplosion(state, stone.x, stone.y - stone.radius, 'coral', 12);
            state.events.push({ type: 'rock-destroyed', kind: 'rolling-stone', points: stone.points });
          } else {
            spawnExplosion(state, shot.x, shot.y, 'ivory', 5);
            state.events.push({ type: 'rock-damaged', kind: 'rolling-stone' });
          }
          break;
        }
      }

      if (!consumed) {
        for (const obs of state.course.obstacles) {
          if (obs.destroyed || !Number.isFinite(obs.hp)) continue;
          const obsGround = groundYAt(
            obs.x + obs.width * 0.5,
            state.course.obstacles,
            state.course.gates,
            state.sectorIndex,
          );
          if (
            shot.x >= obs.x - 6 &&
            shot.x <= obs.x + obs.width + 6 &&
            shot.y >= obsGround - obs.height - 10 &&
            shot.y <= obsGround + 6
          ) {
            obs.hp -= 1;
            consumed = true;
            state.sectionStats.shotsHit += 1;
            if (obs.hp <= 0) {
              obs.destroyed = true;
              state.sectionStats.rocksDestroyed += 1;
              addScore(state, obs.shootPoints);
              spawnExplosion(
                state,
                obs.x + obs.width * 0.5,
                obsGround - obs.height * 0.5,
                'lavender',
                12,
              );
              state.events.push({ type: 'rock-destroyed', kind: obs.kind, points: obs.shootPoints });
            } else {
              spawnExplosion(state, shot.x, shot.y, 'ivory', 5);
              state.events.push({ type: 'rock-damaged', kind: obs.kind });
            }
            break;
          }
        }
      }
    } else if (!consumed && shot.kind === 'upward') {
      for (let u = state.ufos.length - 1; u >= 0; u--) {
        const ufo = state.ufos[u];
        const ufoWorldX = state.cameraX + ufo.screenX;
        if (Math.abs(shot.x - ufoWorldX) <= 28 && Math.abs(shot.y - ufo.y) <= 18) {
          const waveId = ufo.waveId;
          const pts = ufo.points;
          state.ufos.splice(u, 1);
          consumed = true;
          state.sectionStats.shotsHit += 1;
          state.sectionStats.ufosDestroyed += 1;
          addScore(state, pts);
          spawnExplosion(state, ufoWorldX, ufo.y, 'coral', 14);
          const remainingInWave = state.ufos.some((other) => other.waveId === waveId);
          if (!remainingInWave) {
            addScore(state, 500);
            state.events.push({ type: 'wave-cleared', points: pts + 500 });
          } else {
            state.events.push({ type: 'ufo-destroyed', kind: ufo.kind, points: pts });
          }
          break;
        }
      }
    }

    if (consumed) state.shots.splice(i, 1);
  }

  // Update overhead UFOs:
  // - Majority enter from left, increasing fraction enter from right
  // - Move back and forth across patrol bounds over Mona until destroyed!
  // - `bug-dropper`: agile swooping figure-8 wave sweep
  // - `cve-bomber`: steady horizontal stalk-and-hover strafe that pauses to telegraph CVE drops
  for (let u = state.ufos.length - 1; u >= 0; u--) {
    const ufo = state.ufos[u];
    const normKind = normalizeUfoKind(ufo.kind);
    const isCve = normKind === 'cve-bomber';
    ufo.age += dt;
    if (ufo.dropCooldown > 0) ufo.dropCooldown = Math.max(0, ufo.dropCooldown - dt);

    const minX = ufo.minX ?? (isCve ? 74 : 52);
    const maxX = ufo.maxX ?? (isCve ? 470 : 430);
    if (ufo.dir === undefined) ufo.dir = 1;

    // CVE Bomber hover-and-drop telegraph state
    if (ufo.hoverTimer && ufo.hoverTimer > 0) {
      ufo.hoverTimer -= dt;
      ufo.y = ufo.baseY + Math.sin(ufo.age * 16) * 1.5;
      if (ufo.hoverTimer <= 0) {
        ufo.hoverTimer = 0;
        state.bombs.push({
          kind: 'cve',
          carvesCrater: true,
          x: state.cameraX + ufo.screenX,
          y: ufo.y + 12,
          vx: 0,
          vy: 155 + state.sectorIndex * 10,
          age: 0,
        });
        ufo.dropCooldown = ufo.dropInterval ?? 3.0;
        if (ufo.bombsLeft % 2 === 1) ufo.dir *= -1;
        state.events.push({ type: 'cve-dropped', kind: 'cve-bomber' });
      }
      continue;
    }

    const surge = (ufo.surgeAmp ?? 16) * Math.sin(ufo.age * (isCve ? 2.1 : 3.8) + ufo.phase);
    const currentSpeed = Math.max(64, (ufo.passSpeed ?? 98) + surge);
    ufo.screenX += ufo.dir * currentSpeed * dt;

    if (!ufo.entered && ufo.screenX >= minX + 12 && ufo.screenX <= maxX - 12) {
      ufo.entered = true;
    }
    if (ufo.entered) {
      if (ufo.screenX >= maxX) {
        ufo.screenX = maxX;
        ufo.dir = -1;
      } else if (ufo.screenX <= minX) {
        ufo.screenX = minX;
        ufo.dir = 1;
      }
    } else if (ufo.dir === 1 && ufo.screenX >= maxX) {
      ufo.entered = true;
      ufo.dir = -1;
    } else if (ufo.dir === -1 && ufo.screenX <= minX) {
      ufo.entered = true;
      ufo.dir = 1;
    }

    if (isCve) {
      // Steady dreadnought cruise altitude
      ufo.y = ufo.baseY + Math.sin(ufo.age * 1.5 + ufo.phase) * 4;
    } else {
      // Agile swooping figure-8 wave motion
      ufo.y =
        ufo.baseY +
        Math.sin(ufo.age * 3.1 + ufo.phase) * 16 +
        Math.cos(ufo.age * 1.55 + ufo.phase) * 6;
    }

    const isStage1 = state.sectorIndex === 0 && state.loop === 0;
    const relLead = ufo.screenX - state.buggy.screenX;
    // Stage 1 avoids the exact ~165-245px cruise-intercept snipe band so drops stay fair;
    // Stages 2+ unlock full-corridor pressure requiring speed shifts and active shooting.
    const inDropZone = isStage1
      ? isCve
        ? relLead >= 285 && ufo.screenX <= WORLD_WIDTH - 75
        : (relLead >= 265 && ufo.screenX <= WORLD_WIDTH - 75) || (relLead >= -25 && relLead <= 95)
      : relLead >= Math.max(45, ufo.dropLead ?? 90) && ufo.screenX <= WORLD_WIDTH - 70;

    if (
      ufo.entered &&
      ufo.bombsLeft > 0 &&
      (ufo.dropCooldown ?? 0) <= 0 &&
      inDropZone
    ) {
      ufo.bombsLeft -= 1;
      if (isCve) {
        ufo.hoverTimer = 0.38;
        state.events.push({ type: 'cve-telegraph' });
      } else {
        state.bombs.push({
          kind: 'bug',
          carvesCrater: false,
          x: state.cameraX + ufo.screenX,
          y: ufo.y + 12,
          vx: 0,
          vy: 150 + state.sectorIndex * 12 + Math.min(24, state.loop * 10),
          age: 0,
        });
        ufo.dropCooldown = ufo.dropInterval ?? 3.2;
        state.events.push({ type: 'bug-dropped', kind: 'bug-dropper' });
      }
    }
  }

  // Update falling Bugs (explode on contact) & CVEs (carve craters on road impact!)
  for (let b = state.bombs.length - 1; b >= 0; b--) {
    const bomb = state.bombs[b];
    const isCve = bomb.kind === 'cve' || Boolean(bomb.carvesCrater);
    bomb.age = (bomb.age ?? 0) + dt;
    // Bugs flutter slightly as they descend; CVEs drop straight like heavy warheads
    const flutterVx = !isCve ? Math.sin(bomb.age * 9) * 22 : 0;
    bomb.x += (bomb.vx + flutterVx) * dt;
    bomb.vy += (isCve ? 72 : 52) * dt;
    bomb.y += bomb.vy * dt;

    if (
      Math.abs(bomb.x - state.buggy.worldX) <= 18 &&
      bomb.y >= state.buggy.y - 26 &&
      bomb.y <= state.buggy.y + 2
    ) {
      state.bombs.splice(b, 1);
      triggerCrash(state, isCve ? 'CVE warhead' : 'dropped bug');
      return state;
    }

    const bGround = groundYAt(
      bomb.x,
      state.course.obstacles,
      state.course.gates,
      state.sectorIndex,
    );
    if (bomb.y >= bGround) {
      state.bombs.splice(b, 1);
      spawnExplosion(state, bomb.x, bGround - 4, isCve ? 'ruby' : 'coral', isCve ? 14 : 8);
      if (isCve && canCarveCraterAt(state.course, bomb.x - 22)) {
        state.course.obstacles.push({
          id: `cve-crater-${Math.round(bomb.x)}`,
          kind: 'crater-small',
          fromCve: true,
          x: Math.round(bomb.x - 22),
          width: 44,
          height: 26,
          hp: Infinity,
          maxHp: Infinity,
          shootPoints: 0,
          jumpPoints: 120,
          destroyed: false,
          scored: false,
        });
        state.sectionStats.cratersCarved += 1;
        state.events.push({ type: 'crater-carved', x: Math.round(bomb.x) });
      }
    }
  }

  // Update bouncing / rolling highland stones (Stages 4 & 5)
  for (let rs = state.rollingStones.length - 1; rs >= 0; rs--) {
    const stone = state.rollingStones[rs];
    stone.x += stone.vx * dt;
    stone.phase += dt * 10;
    stone.vy += GRAVITY * 0.72 * dt;
    stone.y += stone.vy * dt;

    const sGround = groundYAt(
      stone.x,
      state.course.obstacles,
      state.course.gates,
      state.sectorIndex,
    );
    if (stone.y >= sGround) {
      stone.y = sGround;
      stone.vy = stone.bounceVelocity;
    }

    if (stone.x < state.cameraX - 48) {
      state.rollingStones.splice(rs, 1);
      continue;
    }

    if (
      Math.abs(stone.x - state.buggy.worldX) <= stone.radius + 16 &&
      stone.y >= state.buggy.y - 26 &&
      stone.y - stone.radius * 2 <= state.buggy.y - 4
    ) {
      triggerCrash(state, 'rolling stone');
      return state;
    }

    if (!stone.scored && stone.x + stone.radius < state.buggy.worldX - 24) {
      stone.scored = true;
      state.sectionStats.hazardsJumped += 1;
      addScore(state, 150);
      state.events.push({ type: 'jump-clear', kind: 'rolling-stone', points: 150 });
    }
  }

  // Surface obstacle collisions & clean jump-over bonuses
  const buggyLeft = state.buggy.worldX - 18;
  const buggyRight = state.buggy.worldX + 18;
  const buggyTop = state.buggy.y - 26;
  const buggyBottom = state.buggy.y - 5;

  for (const obs of state.course.obstacles) {
    if (obs.destroyed) continue;
    if (!obs.kind.startsWith('crater')) {
      const obsGround = groundYAt(
        obs.x + obs.width * 0.5,
        state.course.obstacles,
        state.course.gates,
        state.sectorIndex,
      );
      const obsTop = obsGround - obs.height;
      if (
        buggyRight >= obs.x + 5 &&
        buggyLeft <= obs.x + obs.width - 5 &&
        buggyBottom >= obsTop + 4 &&
        buggyTop <= obsGround
      ) {
        triggerCrash(state, obs.kind === 'mine' ? 'landmine' : obs.kind);
        return state;
      }
    }
    if (!obs.scored && obs.x + obs.width < buggyLeft - 6) {
      obs.scored = true;
      state.sectionStats.hazardsJumped += 1;
      addScore(state, obs.jumpPoints);
      state.events.push({ type: 'jump-clear', kind: obs.kind, points: obs.jumpPoints });
    }
  }

  // Checkpoint gates & major sector completion stats
  for (const gate of state.course.gates) {
    if (!gate.reached && state.buggy.worldX >= gate.x) {
      gate.reached = true;
      state.checkpointIndex = gate.cpIndex;
      state.checkpointLetter = gate.letter;

      if (gate.isMajor) {
        const secs = Math.round(state.sectorElapsed * 10) / 10;
        const clearBonus = 1000 + state.sectorIndex * 250;
        const timeBonus = Math.max(0, Math.round((PAR_SECONDS - secs) * 80));
        const ufoBonus = state.sectionStats.ufosDestroyed * 150;
        const flawlessBonus = state.sectionStats.crashes === 0 ? 1000 : 0;
        const totalBonus = clearBonus + timeBonus + ufoBonus + flawlessBonus;
        addScore(state, totalBonus);

        const startLetter = CHECKPOINTS[state.course.startCp];
        const accuracyPct =
          state.sectionStats.shotsFired > 0
            ? Math.min(
                100,
                Math.round((state.sectionStats.shotsHit / state.sectionStats.shotsFired) * 100),
              )
            : 100;

        state.lastSectorBonus = {
          sectorRange: `${startLetter}–${gate.letter}`,
          sectorName: state.course.sectorName,
          themeTitle: state.course.themeTitle,
          letter: gate.letter,
          seconds: secs,
          parSeconds: PAR_SECONDS,
          clearBonus,
          timeBonus,
          ufoBonus,
          flawlessBonus,
          bonus: totalBonus,
          ufosDestroyed: state.sectionStats.ufosDestroyed,
          ufosSpawned: state.sectionStats.ufosSpawned,
          rocksDestroyed:
            state.sectionStats.rocksDestroyed + state.sectionStats.stonesDestroyed,
          bugsDestroyed: state.sectionStats.bugsDestroyed,
          cvesIntercepted: state.sectionStats.cvesIntercepted,
          hazardsJumped: state.sectionStats.hazardsJumped,
          shotsFired: state.sectionStats.shotsFired,
          shotsHit: state.sectionStats.shotsHit,
          accuracyPct,
          crashes: state.sectionStats.crashes,
          livesRemaining: state.lives,
          totalScore: state.score,
        };
        state.status = 'sector-clear';
        state.sectorBannerTimer = 0;
        state.input.accelerate = false;
        state.input.brake = false;
        state.input.fireHeld = false;
        state.shots = [];
        state.ufos = [];
        state.bombs = [];
        state.rollingStones = [];
        state.events.push({
          type: 'sector-clear',
          checkpoint: gate.letter,
          sector: state.course.sectorName,
          seconds: secs,
          bonus: totalBonus,
          stats: state.lastSectorBonus,
        });
        return state;
      }

      addScore(state, 500);
      state.events.push({
        type: 'checkpoint',
        checkpoint: gate.letter,
        points: 500,
      });
    }
  }

  stepParticles(state, dt);
  return state;
}
