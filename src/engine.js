// Pure, deterministic simulation for Mona Patrol (no DOM or Web Audio access).
// Stage 1 (A–E) is tuned for approachable 90%+ completion with left-to-right UFO flyovers
// and full end-of-section performance statistics.

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 360;
export const GROUND_Y = 284;
export const GRAVITY = 840;
export const JUMP_VELOCITY = -372;
export const SECTION_LENGTH = 1300;
export const PAR_SECONDS = 50;
export const EXTRA_LIFE_SCORE = 10_000;

export const CHECKPOINTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const SECTORS = [
  { name: 'main', start: 0, end: 4 },
  { name: 'release', start: 5, end: 9 },
  { name: 'canary', start: 10, end: 14 },
  { name: 'hotfix', start: 15, end: 19 },
  { name: 'omega', start: 20, end: 25 },
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

export function sectorForCheckpoint(cpIndex) {
  const clamped = Math.max(0, Math.min(CHECKPOINTS.length - 1, cpIndex));
  return SECTORS.find((s) => clamped >= s.start && clamped <= s.end) ?? SECTORS[0];
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
    bombsDestroyed: 0,
    rocksDestroyed: 0,
    hazardsJumped: 0,
    crashes: 0,
  };
}

// Stepped 2px lunar ground profile; flat around checkpoints and craters for fair jumps.
export function groundYAt(worldX, obstacles = [], gates = []) {
  for (const gate of gates) {
    if (Math.abs(worldX - gate.x) < 100) return GROUND_Y;
  }
  for (const obs of obstacles) {
    if (obs.kind.startsWith('crater') && worldX >= obs.x - 28 && worldX <= obs.x + obs.width + 28) {
      return GROUND_Y;
    }
  }
  const raw = Math.sin(worldX * 0.012) * 2.4 + Math.cos(worldX * 0.027) * 1.4;
  return GROUND_Y + Math.round(raw / 2) * 2;
}

// Deterministically builds one leg between `cpIndex` and `cpIndex + 1`.
// Stage 1 (A–E, cpIndex 0..3, loop 0) uses extra-generous spacing, narrow craters,
// shootable boulders, and left-to-right flyover UFO waves.
export function generateCourseSection(cpIndex, seed = 2026, loop = 0) {
  const sector = sectorForCheckpoint(cpIndex);
  if (cpIndex >= sector.end) {
    return { obstacles: [], waves: [] };
  }
  const isFirstStage = sector.start === 0 && loop === 0;
  const legOffset = cpIndex - sector.start;
  const startX = legOffset * SECTION_LENGTH;
  const endX = (legOffset + 1) * SECTION_LENGTH;
  const rng = mulberry32(
    ((seed >>> 0) ^ Math.imul(cpIndex + 1, 0x9e3779b1) ^ Math.imul(loop + 1, 0x85ebca6b)) >>> 0,
  );

  const difficulty = cpIndex + loop * 10;
  const obstacles = [];
  let cursor = startX + (cpIndex === 0 && loop === 0 ? 520 : isFirstStage ? 380 : 320);
  const safeEnd = endX - 260;

  while (cursor < safeEnd) {
    const roll = rng();
    let obs;
    if (isFirstStage) {
      // Stage 1 (A–E): mostly shootable 1-HP rocks + gentle narrow craters; 2-HP rock appears in C–E
      if (roll < 0.52) {
        obs = {
          kind: 'rock-small',
          x: Math.round(cursor),
          width: 26,
          height: 22,
          hp: 1,
          maxHp: 1,
          shootPoints: 100,
          jumpPoints: 80,
        };
      } else if (roll < 0.82 || cpIndex < 2) {
        obs = {
          kind: 'crater-small',
          x: Math.round(cursor),
          width: cpIndex === 0 ? 38 : 42,
          height: 26,
          hp: Infinity,
          maxHp: Infinity,
          shootPoints: 0,
          jumpPoints: 100,
        };
      } else if (roll < 0.94) {
        obs = {
          kind: 'rock-tall',
          x: Math.round(cursor),
          width: 32,
          height: 32,
          hp: 2,
          maxHp: 2,
          shootPoints: 200,
          jumpPoints: 120,
        };
      } else {
        obs = {
          kind: 'crater-wide',
          x: Math.round(cursor),
          width: 54,
          height: 30,
          hp: Infinity,
          maxHp: Infinity,
          shootPoints: 0,
          jumpPoints: 150,
        };
      }
    } else if (roll < 0.28) {
      obs = {
        kind: 'crater-small',
        x: Math.round(cursor),
        width: 46,
        height: 26,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 100,
      };
    } else if (roll < 0.5) {
      obs = {
        kind: 'crater-wide',
        x: Math.round(cursor),
        width: difficulty >= 10 ? 74 : 64,
        height: 32,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 150,
      };
    } else if (roll < 0.75) {
      obs = {
        kind: 'rock-small',
        x: Math.round(cursor),
        width: 26,
        height: 24,
        hp: 1,
        maxHp: 1,
        shootPoints: 100,
        jumpPoints: 80,
      };
    } else if (roll < 0.92) {
      obs = {
        kind: 'rock-tall',
        x: Math.round(cursor),
        width: 34,
        height: 34,
        hp: 2,
        maxHp: 2,
        shootPoints: 200,
        jumpPoints: 120,
      };
    } else {
      obs = {
        kind: 'mine',
        x: Math.round(cursor),
        width: 22,
        height: 16,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 120,
      };
    }

    obs.id = `${cpIndex}-${obstacles.length}`;
    obs.destroyed = false;
    obs.scored = false;
    obstacles.push(obs);

    const minGap = isFirstStage ? 350 : obs.kind === 'crater-wide' ? 270 : 240;
    const extraGap = (isFirstStage ? 110 : Math.max(25, 95 - Math.min(50, difficulty * 3))) * rng();
    cursor += obs.width + minGap + Math.round(extraGap);
  }

  const waves = [];
  const waveCount = !isFirstStage && difficulty >= 8 ? 2 : 1;
  for (let w = 0; w < waveCount; w++) {
    const triggerX = Math.round(startX + (cpIndex === 0 ? 340 : 300) + w * 460);
    if (triggerX < endX - 220) {
      const count = isFirstStage
        ? Math.min(3, 1 + Math.floor((cpIndex + 1) / 2))
        : Math.min(4, 2 + ((cpIndex + w + loop) % 2));
      const kind = !isFirstStage && difficulty >= 5 && w === waveCount - 1 ? 'bomber' : 'scout';
      waves.push({
        id: `wave-${cpIndex}-${w}`,
        triggerX,
        spawned: false,
        kind,
        count,
        // Leg A–B UFOs are pure flyover targets; later legs only drop distant slow flares ahead
        allowBombs: cpIndex >= 1 || loop > 0,
      });
    }
  }

  return { obstacles, waves };
}

export function buildSectorCourse(sectorIndex, seed = 2026, loop = 0) {
  const sector = SECTORS[sectorIndex] ?? SECTORS[0];
  const gates = [];
  const obstacles = [];
  const waves = [];

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
    }
  }

  return {
    sectorIndex,
    sectorName: sector.name,
    startCp: sector.start,
    endCp: sector.end,
    length: (sector.end - sector.start) * SECTION_LENGTH,
    gates,
    obstacles,
    waves,
  };
}

export function createGameState(options = {}) {
  const seed = options.seed ?? 2026;
  const bestScore = options.bestScore ?? 0;
  const course = buildSectorCourse(0, seed, 0);
  const startGround = groundYAt(0, course.obstacles, course.gates);

  return {
    status: 'ready', // 'ready' | 'playing' | 'paused' | 'crashing' | 'sector-clear' | 'gameover'
    seed,
    score: 0,
    bestScore,
    nextExtraLifeScore: EXTRA_LIFE_SCORE,
    lives: 3,
    loop: 0,
    sectorIndex: 0,
    checkpointIndex: 0,
    checkpointLetter: 'A',
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
      jumpBuffer: 0,
      coyoteTimer: 0,
      wheelPhase: 0,
      pitch: 0,
    },
    shots: [],
    ufos: [],
    bombs: [],
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

export function startGame(state, options = {}) {
  const fresh = createGameState({
    seed: options.seed ?? state.seed,
    bestScore: state.bestScore,
  });
  Object.assign(state, fresh);
  state.status = 'playing';
  state.events.push({
    type: 'started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
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
  const gY = groundYAt(spawnX, state.course.obstacles, state.course.gates);

  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = spawnX;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.pitch = 0;
  state.cameraX = spawnX - state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.invulnTimer = 2.0;

  for (const wave of state.course.waves) {
    if (wave.triggerX > spawnX + 120) {
      wave.spawned = false;
    }
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
  state.loop = nextLoop;
  state.course = buildSectorCourse(nextSector, state.seed, nextLoop);
  state.checkpointIndex = state.course.startCp;
  state.checkpointLetter = CHECKPOINTS[state.checkpointIndex];
  state.sectorElapsed = 0;
  state.lastSectorBonus = null;
  state.sectionStats = createSectionStats();

  const gY = groundYAt(0, state.course.obstacles, state.course.gates);
  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = 0;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.pitch = 0;
  state.cameraX = -state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.invulnTimer = 1.2;
  state.status = 'playing';
  state.events.push({
    type: 'sector-started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
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

  const gY = groundYAt(0, state.course.obstacles, state.course.gates);
  state.gearIndex = 1;
  state.speed = GEARS[1].speed;
  state.buggy.worldX = 0;
  state.buggy.screenX = GEARS[1].screenX;
  state.buggy.y = gY;
  state.buggy.vy = 0;
  state.buggy.grounded = true;
  state.buggy.pitch = 0;
  state.cameraX = -state.buggy.screenX;
  state.shots = [];
  state.ufos = [];
  state.bombs = [];
  state.invulnTimer = 1.2;
  state.status = 'playing';
  state.events.push({
    type: 'sector-started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
    loop: state.loop,
  });
}

// Every UFO enters from the LEFT edge of the screen (`screenX < 0`) and flies
// left-to-right directly over Mona's rover so the player has a clear shot.
function spawnUfoWave(state, wave) {
  wave.spawned = true;
  const isFirstStage = state.sectorIndex === 0 && state.loop === 0;
  for (let i = 0; i < wave.count; i++) {
    const canDrop = Boolean(wave.allowBombs) && (!isFirstStage || i === 0);
    state.ufos.push({
      id: `${wave.id}-ufo-${i}`,
      waveId: wave.id,
      kind: wave.kind,
      screenX: -36 - i * 82,
      passSpeed: (wave.kind === 'bomber' ? 104 : 92) + (i % 2) * 8,
      y: 66 + (i % 2) * 22,
      baseY: 66 + (i % 2) * 22,
      phase: i * 1.4,
      age: 0,
      bombsLeft: canDrop ? 1 : 0,
      points: wave.kind === 'bomber' ? 300 : 200,
    });
    state.sectionStats.ufosSpawned += 1;
  }
  state.events.push({ type: 'ufo-wave', kind: wave.kind, count: wave.count });
}

function canCarveCraterAt(course, x) {
  for (const gate of course.gates) {
    if (Math.abs(x - gate.x) < 200) return false;
  }
  for (const obs of course.obstacles) {
    if (!obs.destroyed && x + 44 > obs.x - 190 && x < obs.x + obs.width + 190) {
      return false;
    }
  }
  return x > 260 && x < course.length - 260;
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

  // Interactive round-end summary stays open until player continues (or optional timer if set)
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

  // Horizontal speed stays locked while airborne for faithful jump-arc physics.
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

  // Vertical buggy physics & forgiving crater lip margin
  const surfaceY = groundYAt(state.buggy.worldX, state.course.obstacles, state.course.gates);
  const overCrater = state.course.obstacles.find(
    (o) =>
      o.kind.startsWith('crater') &&
      state.buggy.worldX >= o.x + 11 &&
      state.buggy.worldX <= o.x + o.width - 11,
  );

  if (state.buggy.grounded) {
    if (overCrater) {
      state.buggy.grounded = false;
      state.buggy.coyoteTimer = 0.12;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      } else {
        // Give coyote window while falling slightly before crashing
        state.buggy.vy = 20;
      }
    } else {
      state.buggy.y = surfaceY;
      state.buggy.vy = 0;
      state.buggy.pitch = 0;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      }
    }
  } else {
    state.buggy.vy += GRAVITY * dt;
    state.buggy.y += state.buggy.vy * dt;
    state.buggy.pitch = Math.max(-0.2, Math.min(0.2, state.buggy.vy * 0.0005));

    if (overCrater && state.buggy.y > surfaceY + 8 && state.buggy.coyoteTimer <= 0) {
      triggerCrash(state, 'merge-conflict crater');
      return state;
    }

    if (!overCrater && state.buggy.y >= surfaceY) {
      state.buggy.y = surfaceY;
      state.buggy.vy = 0;
      state.buggy.grounded = true;
      state.buggy.pitch = 0;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      }
    }
  }

  // Spawn scheduled UFO waves
  for (const wave of state.course.waves) {
    if (!wave.spawned && state.buggy.worldX >= wave.triggerX) {
      spawnUfoWave(state, wave);
    }
  }

  // Advance shots & test hits
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const shot = state.shots[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;

    if (
      (shot.kind === 'forward' &&
        (shot.x > shot.maxX || shot.x > state.cameraX + WORLD_WIDTH + 24)) ||
      (shot.kind === 'upward' && shot.y < shot.minY)
    ) {
      state.shots.splice(i, 1);
      continue;
    }

    let consumed = false;

    // Both forward and upward shots can intercept falling UFO bombs!
    for (let b = state.bombs.length - 1; b >= 0; b--) {
      const bomb = state.bombs[b];
      if (Math.abs(shot.x - bomb.x) <= 18 && Math.abs(shot.y - bomb.y) <= 18) {
        state.bombs.splice(b, 1);
        consumed = true;
        state.sectionStats.shotsHit += 1;
        state.sectionStats.bombsDestroyed += 1;
        addScore(state, 100);
        spawnExplosion(state, bomb.x, bomb.y, 'mint', 8);
        state.events.push({ type: 'bomb-destroyed', points: 100 });
        break;
      }
    }

    if (!consumed && shot.kind === 'forward') {
      for (const obs of state.course.obstacles) {
        if (obs.destroyed || !Number.isFinite(obs.hp)) continue;
        const obsGround = groundYAt(
          obs.x + obs.width * 0.5,
          state.course.obstacles,
          state.course.gates,
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
            spawnExplosion(state, obs.x + obs.width * 0.5, obsGround - obs.height * 0.5, 'lavender', 12);
            state.events.push({ type: 'rock-destroyed', kind: obs.kind, points: obs.shootPoints });
          } else {
            spawnExplosion(state, shot.x, shot.y, 'ivory', 5);
            state.events.push({ type: 'rock-damaged', kind: obs.kind });
          }
          break;
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
            state.events.push({ type: 'ufo-destroyed', points: pts });
          }
          break;
        }
      }
    }

    if (consumed) state.shots.splice(i, 1);
  }

  // Update overhead Bug UFOs: enter from left (`screenX < 0`), pass directly over
  // Mona's turret (`screenX` crosses `buggy.screenX`), and exit off the right edge.
  for (let u = state.ufos.length - 1; u >= 0; u--) {
    const ufo = state.ufos[u];
    ufo.age += dt;
    ufo.screenX += (ufo.passSpeed ?? 96) * dt;
    const bob = Math.round(Math.sin(ufo.age * 3.2 + ufo.phase) * 3) * 2;
    ufo.y = ufo.baseY + bob;

    if (ufo.screenX > WORLD_WIDTH + 48) {
      state.ufos.splice(u, 1);
      continue;
    }

    // Only drop a slow, visible flare WELL AHEAD of the player after passing overhead
    if (
      ufo.bombsLeft > 0 &&
      ufo.screenX >= state.buggy.screenX + 255 &&
      ufo.screenX <= WORLD_WIDTH - 95
    ) {
      ufo.bombsLeft -= 1;
      state.bombs.push({
        x: state.cameraX + ufo.screenX,
        y: ufo.y + 12,
        vx: state.speed * 0.12,
        vy: 66,
        carvesCrater: ufo.kind === 'bomber' && (state.sectorIndex > 0 || state.loop > 0),
      });
      state.events.push({ type: 'bomb-dropped', kind: ufo.kind });
    }
  }

  // Update slow-drifting plasma bombs
  for (let b = state.bombs.length - 1; b >= 0; b--) {
    const bomb = state.bombs[b];
    bomb.x += bomb.vx * dt;
    bomb.vy += 52 * dt;
    bomb.y += bomb.vy * dt;

    if (
      Math.abs(bomb.x - state.buggy.worldX) <= 18 &&
      bomb.y >= state.buggy.y - 26 &&
      bomb.y <= state.buggy.y + 2
    ) {
      state.bombs.splice(b, 1);
      triggerCrash(state, 'saucer flare');
      return state;
    }

    const bGround = groundYAt(bomb.x, state.course.obstacles, state.course.gates);
    if (bomb.y >= bGround) {
      state.bombs.splice(b, 1);
      spawnExplosion(state, bomb.x, bGround - 4, 'coral', 8);
      if (bomb.carvesCrater && canCarveCraterAt(state.course, bomb.x - 22)) {
        state.course.obstacles.push({
          id: `bomb-crater-${Math.round(bomb.x)}`,
          kind: 'crater-small',
          x: Math.round(bomb.x - 22),
          width: 44,
          height: 24,
          hp: Infinity,
          maxHp: Infinity,
          shootPoints: 0,
          jumpPoints: 100,
          destroyed: false,
          scored: false,
        });
        state.events.push({ type: 'crater-carved' });
      }
    }
  }

  // Surface obstacle collisions (with forgiving inset) & clean jump-over bonuses
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
      );
      const obsTop = obsGround - obs.height;
      if (
        buggyRight >= obs.x + 5 &&
        buggyLeft <= obs.x + obs.width - 5 &&
        buggyBottom >= obsTop + 5 &&
        buggyTop <= obsGround
      ) {
        triggerCrash(state, obs.kind);
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
        const clearBonus = 1000;
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
          rocksDestroyed: state.sectionStats.rocksDestroyed,
          bombsDestroyed: state.sectionStats.bombsDestroyed,
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
