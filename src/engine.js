// Pure, deterministic simulation for Mona Patrol (no DOM or Web Audio access).

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 360;
export const GROUND_Y = 286;
export const GRAVITY = 880;
export const JUMP_VELOCITY = -355;
export const SECTION_LENGTH = 1450;
export const PAR_SECONDS = 40;
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
  { id: 'slow', label: 'SLOW', speed: 120, screenX: 112 },
  { id: 'cruise', label: 'CRUISE', speed: 178, screenX: 148 },
  { id: 'fast', label: 'BOOST', speed: 242, screenX: 188 },
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

export function groundYAt(worldX, obstacles = [], gates = []) {
  for (const gate of gates) {
    if (Math.abs(worldX - gate.x) < 90) return GROUND_Y;
  }
  for (const obs of obstacles) {
    if (obs.kind.startsWith('crater') && worldX >= obs.x - 24 && worldX <= obs.x + obs.width + 24) {
      return GROUND_Y;
    }
  }
  const wave = Math.sin(worldX * 0.014) * 3.2 + Math.cos(worldX * 0.031) * 1.6;
  return Math.round((GROUND_Y + wave) * 10) / 10;
}

// Deterministically builds one leg between checkpoint `legIndex` and `legIndex + 1`
// within a sector, guaranteeing safe spawn/gate buffers and jumpable spacing.
export function generateCourseSection(cpIndex, seed = 2026, loop = 0) {
  const sector = sectorForCheckpoint(cpIndex);
  if (cpIndex >= sector.end) {
    return { obstacles: [], waves: [] };
  }
  const legOffset = cpIndex - sector.start;
  const startX = legOffset * SECTION_LENGTH;
  const endX = (legOffset + 1) * SECTION_LENGTH;
  const rng = mulberry32(((seed >>> 0) ^ Math.imul(cpIndex + 1, 0x9e3779b1) ^ Math.imul(loop + 1, 0x85ebca6b)) >>> 0);

  const difficulty = cpIndex + loop * 10;
  const obstacles = [];
  let cursor = startX + (cpIndex === 0 && loop === 0 ? 520 : 310);
  const safeEnd = endX - 240;

  while (cursor < safeEnd) {
    const roll = rng();
    let obs;
    if (roll < 0.28) {
      obs = {
        kind: 'crater-small',
        x: Math.round(cursor),
        width: 48,
        height: 26,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 100,
      };
    } else if (roll < 0.5 && difficulty >= 1) {
      obs = {
        kind: 'crater-wide',
        x: Math.round(cursor),
        width: difficulty >= 8 ? 84 : 72,
        height: 32,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 150,
      };
    } else if (roll < 0.76) {
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
    } else if (roll < 0.92 || difficulty < 2) {
      obs = {
        kind: 'rock-tall',
        x: Math.round(cursor),
        width: 34,
        height: 36,
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

    const minGap = obs.kind === 'crater-wide' ? 255 : 225;
    const extraGap = Math.max(20, 95 - Math.min(55, difficulty * 3)) * rng();
    cursor += obs.width + minGap + Math.round(extraGap);
  }

  const waves = [];
  const waveCount = difficulty >= 6 ? 2 : 1;
  for (let w = 0; w < waveCount; w++) {
    const triggerX = Math.round(startX + 430 + w * 480);
    if (triggerX < endX - 220) {
      const count = Math.min(4, 2 + ((cpIndex + w + loop) % 2) + (difficulty >= 10 ? 1 : 0));
      const kind = difficulty >= 3 && w === waveCount - 1 ? 'bomber' : 'scout';
      waves.push({
        id: `wave-${cpIndex}-${w}`,
        triggerX,
        spawned: false,
        kind,
        count,
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
    gearIndex: 1, // 0=slow, 1=cruise, 2=fast
    speed: GEARS[1].speed,
    cameraX: 0 - GEARS[1].screenX,
    fireCooldown: 0,
    crashTimer: 0,
    crashReason: '',
    sectorBannerTimer: 0,
    lastSectorBonus: null,
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
  state.buggy.jumpBuffer = 0.11;
  return false;
}

export function fireWeapons(state) {
  if (state.status !== 'playing' || state.fireCooldown > 0) return false;
  const forwardActive = state.shots.filter((s) => s.kind === 'forward').length;
  const upwardActive = state.shots.filter((s) => s.kind === 'upward').length;
  if (forwardActive >= 3 && upwardActive >= 3) return false;

  if (forwardActive < 3) {
    state.shots.push({
      kind: 'forward',
      x: state.buggy.worldX + 28,
      y: state.buggy.y - 15,
      vx: state.speed + 390,
      vy: 0,
      maxX: state.buggy.worldX + 275,
    });
  }
  if (upwardActive < 3) {
    state.shots.push({
      kind: 'upward',
      x: state.buggy.worldX - 4,
      y: state.buggy.y - 28,
      vx: state.speed * 0.9,
      vy: -450,
      minY: 14,
    });
  }
  state.fireCooldown = 0.22;
  state.events.push({ type: 'fire' });
  return true;
}

function spawnExplosion(state, x, y, colorKind = 'coral', count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 45 + (i % 3) * 35;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      life: 0.42,
      maxLife: 0.42,
      colorKind,
    });
  }
}

export function triggerCrash(state, reason) {
  if (state.status !== 'playing' || state.invulnTimer > 0) return false;
  state.status = 'crashing';
  state.crashTimer = 0.85;
  state.crashReason = reason;
  state.input.accelerate = false;
  state.input.brake = false;
  state.input.fireHeld = false;
  state.shots = [];
  spawnExplosion(state, state.buggy.worldX, state.buggy.y - 14, 'ruby', 16);
  state.events.push({ type: 'crash', reason, livesLeft: state.lives - 1 });
  return true;
}

function respawnAtCheckpoint(state) {
  const gate = state.course.gates.find((g) => g.cpIndex === state.checkpointIndex) ?? state.course.gates[0];
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
  state.invulnTimer = 1.5;

  // Reset unreached waves ahead so aerial encounters replay cleanly on retry
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
  state.invulnTimer = 1.0;
  state.status = 'playing';
  state.events.push({
    type: 'sector-started',
    checkpoint: state.checkpointLetter,
    sector: state.course.sectorName,
    loop: state.loop,
  });
}

function spawnUfoWave(state, wave) {
  wave.spawned = true;
  for (let i = 0; i < wave.count; i++) {
    state.ufos.push({
      id: `${wave.id}-ufo-${i}`,
      waveId: wave.id,
      kind: wave.kind,
      screenX: -36 - i * 54,
      targetScreenX: 250 + i * 78,
      y: 66 + (i % 2) * 28,
      baseY: 66 + (i % 2) * 28,
      phase: i * 1.3,
      age: 0,
      bombCooldown: 1.05 + i * 0.55,
      bombsLeft: wave.kind === 'bomber' ? 2 : 1,
      points: wave.kind === 'bomber' ? 300 : 200,
    });
  }
  state.events.push({ type: 'ufo-wave', kind: wave.kind, count: wave.count });
}

function canCarveCraterAt(course, x) {
  for (const gate of course.gates) {
    if (Math.abs(x - gate.x) < 180) return false;
  }
  for (const obs of course.obstacles) {
    if (!obs.destroyed && x + 44 > obs.x - 165 && x < obs.x + obs.width + 165) {
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
    state.sectorBannerTimer -= dt;
    if (state.sectorBannerTimer <= 0) {
      advanceToNextSector(state);
    }
    return state;
  }

  if (state.status !== 'playing') return state;

  state.elapsed += dt;
  state.sectorElapsed += dt;
  if (state.fireCooldown > 0) state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (state.invulnTimer > 0) state.invulnTimer = Math.max(0, state.invulnTimer - dt);
  if (state.buggy.jumpBuffer > 0) state.buggy.jumpBuffer = Math.max(0, state.buggy.jumpBuffer - dt);
  if (state.buggy.coyoteTimer > 0) state.buggy.coyoteTimer = Math.max(0, state.buggy.coyoteTimer - dt);

  if (state.input.fireHeld && state.fireCooldown <= 0) {
    fireWeapons(state);
  }

  const gear = GEARS[state.gearIndex];
  const holdDelta = (state.input.accelerate ? 18 : 0) - (state.input.brake ? 16 : 0);
  const targetSpeed = Math.max(95, gear.speed + holdDelta);

  // Horizontal speed stays locked while airborne for faithful jump-arc physics.
  if (state.buggy.grounded) {
    const accelRate = 420 * dt;
    if (state.speed < targetSpeed) state.speed = Math.min(targetSpeed, state.speed + accelRate);
    else if (state.speed > targetSpeed) state.speed = Math.max(targetSpeed, state.speed - accelRate);
  }

  const targetScreenX = gear.screenX + (state.input.accelerate ? 10 : 0) - (state.input.brake ? 10 : 0);
  state.buggy.screenX += (targetScreenX - state.buggy.screenX) * Math.min(1, dt * 6);

  const dx = state.speed * dt;
  state.buggy.worldX += dx;
  state.buggy.wheelPhase += dx * 0.12;
  state.cameraX = state.buggy.worldX - state.buggy.screenX;

  state.distanceRemainder += dx;
  while (state.distanceRemainder >= 100) {
    state.distanceRemainder -= 100;
    addScore(state, 10);
  }

  // Vertical buggy physics & crater chasm check
  const surfaceY = groundYAt(state.buggy.worldX, state.course.obstacles, state.course.gates);
  const overCrater = state.course.obstacles.find(
    (o) =>
      o.kind.startsWith('crater') &&
      state.buggy.worldX >= o.x + 8 &&
      state.buggy.worldX <= o.x + o.width - 8,
  );

  if (state.buggy.grounded) {
    if (overCrater) {
      state.buggy.grounded = false;
      state.buggy.coyoteTimer = 0.055;
      if (state.buggy.jumpBuffer > 0) {
        requestJump(state);
      } else {
        triggerCrash(state, 'merge-conflict crater');
        return state;
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
    state.buggy.pitch = Math.max(-0.24, Math.min(0.24, state.buggy.vy * 0.00055));

    if (state.buggy.y >= surfaceY) {
      if (overCrater) {
        triggerCrash(state, 'merge-conflict crater');
        return state;
      }
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
      (shot.kind === 'forward' && (shot.x > shot.maxX || shot.x > state.cameraX + WORLD_WIDTH + 20)) ||
      (shot.kind === 'upward' && shot.y < shot.minY)
    ) {
      state.shots.splice(i, 1);
      continue;
    }

    let consumed = false;
    if (shot.kind === 'forward') {
      for (const obs of state.course.obstacles) {
        if (obs.destroyed || !Number.isFinite(obs.hp)) continue;
        const obsGround = groundYAt(obs.x + obs.width * 0.5, state.course.obstacles, state.course.gates);
        if (
          shot.x >= obs.x - 4 &&
          shot.x <= obs.x + obs.width + 4 &&
          shot.y >= obsGround - obs.height - 6 &&
          shot.y <= obsGround + 4
        ) {
          obs.hp -= 1;
          consumed = true;
          if (obs.hp <= 0) {
            obs.destroyed = true;
            addScore(state, obs.shootPoints);
            spawnExplosion(state, obs.x + obs.width * 0.5, obsGround - obs.height * 0.5, 'lavender', 10);
            state.events.push({ type: 'rock-destroyed', kind: obs.kind, points: obs.shootPoints });
          } else {
            spawnExplosion(state, shot.x, shot.y, 'ivory', 4);
            state.events.push({ type: 'rock-damaged', kind: obs.kind });
          }
          break;
        }
      }
    } else {
      // Upward shots hit falling bombs or overhead Bug UFOs
      for (let b = state.bombs.length - 1; b >= 0; b--) {
        const bomb = state.bombs[b];
        if (Math.abs(shot.x - bomb.x) <= 14 && Math.abs(shot.y - bomb.y) <= 14) {
          state.bombs.splice(b, 1);
          consumed = true;
          addScore(state, 100);
          spawnExplosion(state, bomb.x, bomb.y, 'mint', 8);
          state.events.push({ type: 'bomb-destroyed', points: 100 });
          break;
        }
      }
      if (!consumed) {
        for (let u = state.ufos.length - 1; u >= 0; u--) {
          const ufo = state.ufos[u];
          const ufoWorldX = state.cameraX + ufo.screenX;
          if (Math.abs(shot.x - ufoWorldX) <= 22 && Math.abs(shot.y - ufo.y) <= 15) {
            const waveId = ufo.waveId;
            const pts = ufo.points;
            state.ufos.splice(u, 1);
            consumed = true;
            addScore(state, pts);
            spawnExplosion(state, ufoWorldX, ufo.y, 'coral', 12);
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
    }

    if (consumed) state.shots.splice(i, 1);
  }

  // Update overhead Bug UFOs
  for (let u = state.ufos.length - 1; u >= 0; u--) {
    const ufo = state.ufos[u];
    ufo.age += dt;
    if (ufo.age > 9.5) {
      ufo.screenX += 240 * dt;
      if (ufo.screenX > WORLD_WIDTH + 60) {
        state.ufos.splice(u, 1);
        continue;
      }
    } else {
      const weaveX = Math.sin(ufo.age * 1.9 + ufo.phase) * 42;
      const desiredX = ufo.targetScreenX + weaveX;
      ufo.screenX += (desiredX - ufo.screenX) * Math.min(1, dt * 2.6);
      ufo.y = ufo.baseY + Math.cos(ufo.age * 2.6 + ufo.phase) * (ufo.kind === 'bomber' ? 18 : 10);

      ufo.bombCooldown -= dt;
      if (ufo.bombCooldown <= 0 && ufo.bombsLeft > 0 && ufo.screenX > state.buggy.screenX + 75 && ufo.screenX < WORLD_WIDTH - 50) {
        ufo.bombsLeft -= 1;
        ufo.bombCooldown = ufo.kind === 'bomber' ? 2.1 : 2.8;
        state.bombs.push({
          x: state.cameraX + ufo.screenX,
          y: ufo.y + 12,
          vx: state.speed * 0.35,
          vy: 145,
          carvesCrater: ufo.kind === 'bomber',
        });
        state.events.push({ type: 'bomb-dropped', kind: ufo.kind });
      }
    }
  }

  // Update falling regression bombs
  for (let b = state.bombs.length - 1; b >= 0; b--) {
    const bomb = state.bombs[b];
    bomb.x += bomb.vx * dt;
    bomb.vy += 170 * dt;
    bomb.y += bomb.vy * dt;

    if (
      Math.abs(bomb.x - state.buggy.worldX) <= 24 &&
      bomb.y >= state.buggy.y - 28 &&
      bomb.y <= state.buggy.y + 4
    ) {
      state.bombs.splice(b, 1);
      triggerCrash(state, 'regression bomb');
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

  // Surface obstacle collisions & clean jump-over bonuses
  const buggyLeft = state.buggy.worldX - 21;
  const buggyRight = state.buggy.worldX + 21;
  const buggyTop = state.buggy.y - 26;
  const buggyBottom = state.buggy.y - 3;

  for (const obs of state.course.obstacles) {
    if (obs.destroyed) continue;
    if (!obs.kind.startsWith('crater')) {
      const obsGround = groundYAt(obs.x + obs.width * 0.5, state.course.obstacles, state.course.gates);
      const obsTop = obsGround - obs.height;
      if (
        buggyRight >= obs.x + 3 &&
        buggyLeft <= obs.x + obs.width - 3 &&
        buggyBottom >= obsTop + 3 &&
        buggyTop <= obsGround
      ) {
        triggerCrash(state, obs.kind);
        return state;
      }
    }
    if (!obs.scored && obs.x + obs.width < buggyLeft - 6) {
      obs.scored = true;
      addScore(state, obs.jumpPoints);
      state.events.push({ type: 'jump-clear', kind: obs.kind, points: obs.jumpPoints });
    }
  }

  // Checkpoint gates & major sector completion
  for (const gate of state.course.gates) {
    if (!gate.reached && state.buggy.worldX >= gate.x) {
      gate.reached = true;
      state.checkpointIndex = gate.cpIndex;
      state.checkpointLetter = gate.letter;

      if (gate.isMajor) {
        const secs = Math.round(state.sectorElapsed * 10) / 10;
        const timeBonus = Math.max(0, Math.round((PAR_SECONDS - secs) * 100));
        const totalBonus = 1000 + timeBonus;
        addScore(state, totalBonus);
        state.lastSectorBonus = {
          sectorName: state.course.sectorName,
          letter: gate.letter,
          seconds: secs,
          parSeconds: PAR_SECONDS,
          bonus: totalBonus,
        };
        state.status = 'sector-clear';
        state.sectorBannerTimer = 1.8;
        state.shots = [];
        state.ufos = [];
        state.bombs = [];
        state.events.push({
          type: 'sector-clear',
          checkpoint: gate.letter,
          sector: state.course.sectorName,
          seconds: secs,
          bonus: totalBonus,
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
