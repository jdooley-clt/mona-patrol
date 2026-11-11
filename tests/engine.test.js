import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKPOINTS,
  EXTRA_LIFE_SCORE,
  GEARS,
  GROUND_Y,
  PAR_SECONDS,
  SECTION_LENGTH,
  WORLD_WIDTH,
  advanceToNextSector,
  buildSectorCourse,
  createGameState,
  fireWeapons,
  generateCourseSection,
  groundYAt,
  replayCurrentSector,
  requestJump,
  shiftGear,
  startGame,
  stepGame,
  togglePause,
} from '../src/engine.js';

test('deterministic course generation produces repeatable, safely spaced legs', () => {
  const first = generateCourseSection(0, 4242, 0);
  const second = generateCourseSection(0, 4242, 0);
  assert.deepEqual(first, second);
  assert.ok(first.obstacles.length >= 1, 'opening leg has gentle introductory hazards');
  assert.ok(first.waves.length >= 1, 'leg schedules at least one UFO wave');

  for (let i = 0; i < first.obstacles.length; i++) {
    const obs = first.obstacles[i];
    assert.ok(obs.x >= 300, 'safe spawn runway after gate');
    assert.ok(obs.x + obs.width <= SECTION_LENGTH - 200, 'safe approach before next gate');
    if (i > 0) {
      const prev = first.obstacles[i - 1];
      const gap = obs.x - (prev.x + prev.width);
      assert.ok(gap >= 350, `Stage 1 obstacles maintain generous gap (got ${gap})`);
    }
  }
});

test('jump arc leaves the ground, peaks, locks horizontal speed in air, and lands cleanly', () => {
  const state = createGameState({ seed: 99 });
  startGame(state, { seed: 99 });
  state.course.obstacles = [];
  state.course.waves = [];

  const startY = state.buggy.y;
  const takeoffSpeed = state.speed;
  assert.equal(requestJump(state), true);
  assert.equal(state.buggy.grounded, false);
  assert.ok(state.buggy.vy < 0);

  // Changing gear mid-air does not alter horizontal velocity until landing
  shiftGear(state, 1);
  stepGame(state, 0.04);
  assert.equal(state.speed, takeoffSpeed);
  assert.ok(state.buggy.y < startY, 'buggy rises above ground');

  let minY = state.buggy.y;
  for (let i = 0; i < 30 && !state.buggy.grounded; i++) {
    stepGame(state, 0.04);
    if (state.buggy.y < minY) minY = state.buggy.y;
  }

  assert.ok(startY - minY > 55, 'jump arc reaches clearance height');
  assert.equal(state.buggy.grounded, true);
  stepGame(state, 0.25);
  assert.ok(state.speed > takeoffSpeed, 'gear speed applies once grounded');
});

test('craters and boulders cause crashes on impact, while jumping craters awards clear points', () => {
  const state = createGameState({ seed: 7 });
  startGame(state, { seed: 7 });
  state.course.waves = [];
  state.course.obstacles = [
    {
      id: 'c1',
      kind: 'crater-small',
      x: 200,
      width: 48,
      height: 26,
      hp: Infinity,
      maxHp: Infinity,
      shootPoints: 0,
      jumpPoints: 100,
      destroyed: false,
      scored: false,
    },
  ];

  // Drive straight into crater without jumping -> crash & respawn at A with 2 lives
  for (let i = 0; i < 60 && state.status === 'playing'; i++) {
    stepGame(state, 0.03);
  }
  assert.equal(state.status, 'crashing');
  assert.equal(state.crashReason, 'merge-conflict crater');

  for (let i = 0; i < 30 && state.status === 'crashing'; i++) {
    stepGame(state, 0.04);
  }
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 2);
  assert.equal(state.buggy.worldX, 0);

  // Now leap cleanly over the crater
  while (state.buggy.worldX < 175) {
    stepGame(state, 0.02);
  }
  const scoreBefore = state.score;
  assert.equal(requestJump(state), true);
  while (state.buggy.worldX < 285) {
    stepGame(state, 0.02);
  }
  assert.equal(state.status, 'playing');
  assert.equal(state.course.obstacles[0].scored, true);
  assert.ok(state.score >= scoreBefore + 100);

  // Driving without jumping over the smallest 38px crater MUST crash at Slow, Cruise, AND Boost!
  for (const [gearIdx, holdAccel] of [
    [0, false],
    [1, false],
    [2, true],
  ]) {
    const s = createGameState({ seed: 9 });
    startGame(s, { seed: 9 });
    s.invulnTimer = 0;
    s.gearIndex = gearIdx;
    s.speed = GEARS[gearIdx].speed + (holdAccel ? 18 : 0);
    s.input.accelerate = holdAccel;
    s.course.waves = [];
    s.course.obstacles = [
      {
        id: 'tiny-crater',
        kind: 'crater-small',
        x: 180,
        width: 38,
        height: 26,
        hp: Infinity,
        maxHp: Infinity,
        shootPoints: 0,
        jumpPoints: 100,
        destroyed: false,
        scored: false,
      },
    ];
    for (let i = 0; i < 130 && s.status === 'playing'; i++) {
      stepGame(s, 0.016);
    }
    assert.equal(
      s.status,
      'crashing',
      `Driving over 38px small crater without jumping must crash at gear ${gearIdx}`,
    );
  }
});

test('forward laser destroys 1-HP and 2-HP boulders; upward turret destroys UFOs and bombs', () => {
  const state = createGameState({ seed: 12 });
  startGame(state, { seed: 12 });
  state.course.waves = [];
  state.course.obstacles = [
    {
      id: 'r1',
      kind: 'rock-small',
      x: 120,
      width: 26,
      height: 24,
      hp: 1,
      maxHp: 1,
      shootPoints: 100,
      jumpPoints: 80,
      destroyed: false,
      scored: false,
    },
    {
      id: 'r2',
      kind: 'rock-tall',
      x: 210,
      width: 34,
      height: 36,
      hp: 2,
      maxHp: 2,
      shootPoints: 200,
      jumpPoints: 120,
      destroyed: false,
      scored: false,
    },
  ];

  state.ufos.push({
    id: 'ufo-test',
    waveId: 'wave-test',
    kind: 'scout',
    screenX: state.buggy.screenX - 4,
    targetScreenX: state.buggy.screenX - 4,
    y: 190,
    baseY: 190,
    phase: 0,
    age: 0,
    bombCooldown: 99,
    bombsLeft: 0,
    points: 200,
  });

  assert.equal(fireWeapons(state), true);
  assert.equal(state.shots.length, 2);

  for (let i = 0; i < 20; i++) {
    stepGame(state, 0.02);
  }
  assert.equal(state.course.obstacles[0].destroyed, true, '1-HP boulder destroyed');
  assert.equal(state.ufos.length, 0, 'overhead UFO destroyed by upward bolt');

  // Fire two more volleys to crack and destroy the 2-HP tall boulder
  state.fireCooldown = 0;
  fireWeapons(state);
  for (let i = 0; i < 15; i++) stepGame(state, 0.02);
  assert.equal(state.course.obstacles[1].hp, 1, 'tall boulder cracked after 1st hit');
  assert.equal(state.course.obstacles[1].destroyed, false);

  state.fireCooldown = 0;
  fireWeapons(state);
  for (let i = 0; i < 15; i++) stepGame(state, 0.02);
  assert.equal(state.course.obstacles[1].destroyed, true, 'tall boulder shattered after 2nd hit');
});

test('checkpoints save respawn progress, sector E awards time bonus, and 0 lives ends game', () => {
  const state = createGameState({ seed: 2026 });
  startGame(state, { seed: 2026 });
  state.course.obstacles = [];
  state.course.waves = [];

  // Drive past Checkpoint B (x = SECTION_LENGTH)
  while (state.checkpointLetter === 'A') {
    stepGame(state, 0.05);
  }
  assert.equal(state.checkpointLetter, 'B');
  assert.ok(state.score >= 500);

  // Simulate crash after B -> respawns at Checkpoint B, not A
  state.invulnTimer = 0;
  state.bombs.push({
    x: state.buggy.worldX,
    y: state.buggy.y - 10,
    vx: 0,
    vy: 120,
    carvesCrater: false,
  });
  stepGame(state, 0.02);
  assert.equal(state.status, 'crashing');
  while (state.status === 'crashing') stepGame(state, 0.05);
  assert.equal(state.status, 'playing');
  assert.equal(state.buggy.worldX, SECTION_LENGTH);
  assert.equal(state.lives, 2);

  // Drive through C, D, and major gate E
  shiftGear(state, 1); // BOOST
  while (state.status === 'playing') {
    stepGame(state, 0.05);
  }
  assert.equal(state.status, 'sector-clear');
  assert.equal(state.checkpointLetter, 'E');
  assert.ok(state.lastSectorBonus.seconds < PAR_SECONDS);
  assert.ok(state.lastSectorBonus.bonus > 1000, 'par speed earns bonus above 1000');

  advanceToNextSector(state);
  assert.equal(state.status, 'playing');
  assert.equal(state.checkpointLetter, 'F');
  assert.equal(state.course.sectorName, 'release');
  assert.equal(CHECKPOINTS[state.course.endCp], 'J');

  // Extra life check & pause check
  assert.equal(togglePause(state), true);
  assert.equal(state.status, 'paused');
  const pausedX = state.buggy.worldX;
  stepGame(state, 0.5);
  assert.equal(state.buggy.worldX, pausedX, 'simulation does not advance while paused');
  assert.equal(togglePause(state), true);
  assert.equal(state.status, 'playing');

  // Drain remaining lives to reach gameover
  state.lives = 1;
  state.nextExtraLifeScore = EXTRA_LIFE_SCORE * 100;
  state.invulnTimer = 0;
  state.bombs.push({
    x: state.buggy.worldX,
    y: state.buggy.y - 10,
    vx: 0,
    vy: 120,
    carvesCrater: false,
  });
  stepGame(state, 0.02);
  while (state.status === 'crashing') stepGame(state, 0.05);
  assert.equal(state.status, 'gameover');
  assert.equal(state.lives, 0);
});

test('bomber bombs carve craters only in safe road stretches and groundYAt flattens near gates', () => {
  const course = buildSectorCourse(0, 55, 0);
  assert.equal(groundYAt(0, course.obstacles, course.gates), GROUND_Y);
  assert.equal(groundYAt(SECTION_LENGTH, course.obstacles, course.gates), GROUND_Y);

  const state = createGameState({ seed: 55 });
  startGame(state, { seed: 55 });
  state.course.obstacles = [];
  state.course.waves = [];
  state.bombs.push({
    x: 600,
    y: GROUND_Y - 2,
    vx: 0,
    vy: 200,
    carvesCrater: true,
  });
  stepGame(state, 0.04);
  assert.equal(state.course.obstacles.length, 1);
  assert.equal(state.course.obstacles[0].kind, 'crater-small');
});

test('Bug-Dropper UFOs drop exploding bugs while CVE-Bomber UFOs drop crater-carving CVEs, with faster/sooner drops in higher stages', () => {
  const stage1 = buildSectorCourse(0, 2026, 0);
  const stage2 = buildSectorCourse(1, 2026, 0);
  const stage3 = buildSectorCourse(2, 2026, 0);

  const s1Specs = stage1.waves.flatMap((w) => w.ufoSpecs);
  const s2Specs = stage2.waves.flatMap((w) => w.ufoSpecs);
  const s3Specs = stage3.waves.flatMap((w) => w.ufoSpecs);

  assert.ok(s2Specs.some((u) => u.kind === 'bug-dropper'), 'Stage 2 includes bug-dropper UFOs');
  assert.ok(s2Specs.some((u) => u.kind === 'cve-bomber'), 'Stage 2 includes cve-bomber UFOs');

  const uniqueStage2Speeds = new Set(s2Specs.map((u) => u.passSpeed));
  assert.ok(uniqueStage2Speeds.size >= 2, 'Stage 2 UFOs vary in speed');
  assert.ok(s2Specs.every((u) => u.surgeAmp > 0), 'Higher-stage UFOs dynamically vary speed');

  const avgLead1 = s1Specs.reduce((a, u) => a + u.dropLead, 0) / s1Specs.length;
  const avgLead2 = s2Specs.reduce((a, u) => a + u.dropLead, 0) / s2Specs.length;
  const avgLead3 = s3Specs.reduce((a, u) => a + u.dropLead, 0) / s3Specs.length;
  assert.ok(avgLead2 < avgLead1, 'Stage 2 UFOs start dropping bugs sooner than Stage 1');
  assert.ok(avgLead3 < avgLead2, 'Stage 3 UFOs start dropping bugs sooner than Stage 2');

  // Verify Bug explodes on road WITHOUT carving a crater, whereas CVE carves a crater on impact
  const state = createGameState({ seed: 77, sectorIndex: 1 });
  startGame(state, { seed: 77, sectorIndex: 1 });
  state.course.obstacles = [];
  state.course.waves = [];

  state.bombs.push({
    kind: 'bug',
    carvesCrater: false,
    x: 600,
    y: GROUND_Y - 2,
    vx: 0,
    vy: 150,
    age: 0,
  });
  stepGame(state, 0.04);
  assert.equal(state.course.obstacles.length, 0, 'Dropped bug explodes without carving a crater');

  state.bombs.push({
    kind: 'cve',
    carvesCrater: true,
    x: 640,
    y: GROUND_Y - 2,
    vx: 0,
    vy: 150,
    age: 0,
  });
  stepGame(state, 0.04);
  assert.equal(state.course.obstacles.length, 1, 'Dropped CVE carves a new crater on impact');
  assert.equal(state.course.obstacles[0].fromCve, true);
  assert.equal(state.sectionStats.cratersCarved, 1);
});

test('Stage 3 (K–O) introduces indestructible mines in tricky combinations and Stage 4 (P–T) adds hills with rolling stones', () => {
  const stage1 = buildSectorCourse(0, 2026, 0);
  const stage2 = buildSectorCourse(1, 2026, 0);
  const stage3 = buildSectorCourse(2, 2026, 0);
  const stage4 = buildSectorCourse(3, 2026, 0);

  assert.equal(stage1.obstacles.filter((o) => o.kind === 'mine').length, 0, 'No mines in Stage 1');
  assert.equal(stage2.obstacles.filter((o) => o.kind === 'mine').length, 0, 'No mines in Stage 2');

  const stage3Mines = stage3.obstacles.filter((o) => o.kind === 'mine');
  assert.ok(stage3Mines.length >= 8, `Stage 3 places mines across legs (got ${stage3Mines.length})`);
  assert.ok(stage3Mines.every((m) => !Number.isFinite(m.hp)), 'Mines must be jumped, not shot');

  // Verify Stage 3 includes close skill combinations (paired spacing <= 165px)
  let comboPairs = 0;
  for (let i = 1; i < stage3.obstacles.length; i++) {
    const gap =
      stage3.obstacles[i].x - (stage3.obstacles[i - 1].x + stage3.obstacles[i - 1].width);
    if (gap <= 165) comboPairs += 1;
  }
  assert.ok(comboPairs >= 2, `Stage 3 builds tricky obstacle combinations (got ${comboPairs})`);

  // Verify Stage 4 hills vary elevation and spawn bouncing rolling stones
  const heights = [];
  for (let wx = 300; wx <= 1050; wx += 50) {
    heights.push(groundYAt(wx, [], stage4.gates, 3));
  }
  const hillSpan = Math.max(...heights) - Math.min(...heights);
  assert.ok(hillSpan >= 14, `Stage 4 features pronounced hills (span ${hillSpan}px)`);
  assert.ok(stage4.stoneSpawns.length >= 4, 'Stage 4 schedules rolling stones across legs');

  const state = createGameState({ seed: 2026, sectorIndex: 3 });
  startGame(state, { seed: 2026, sectorIndex: 3 });
  state.course.obstacles = [];
  state.course.waves = [];

  while (state.rollingStones.length === 0) {
    stepGame(state, 0.04);
  }
  const stone = state.rollingStones[0];
  const initialX = stone.x;
  stepGame(state, 0.05);
  assert.ok(stone.x < initialX, 'Rolling stone advances toward the rover');

  // Place stone in front of rover and shatter it with 2 forward laser shots
  stone.x = state.buggy.worldX + 110;
  stone.y = state.buggy.y;
  stone.vy = -80;
  state.fireCooldown = 0;
  fireWeapons(state);
  for (let i = 0; i < 8; i++) stepGame(state, 0.02);
  assert.equal(state.rollingStones.length, 1, 'Rolling stone survives 1st hit');
  state.fireCooldown = 0;
  fireWeapons(state);
  for (let i = 0; i < 10; i++) stepGame(state, 0.02);
  assert.equal(state.rollingStones.length, 0, 'Rolling stone shatters on 2nd hit');
  assert.equal(state.sectionStats.stonesDestroyed, 1);
});

test('UFOs enter mostly from left with increasing right entries, patrol back and forth until destroyed, and use distinct patterns', () => {
  const stage1Specs = buildSectorCourse(0, 2026, 0).waves.flatMap((w) => w.ufoSpecs);
  const stage2Specs = buildSectorCourse(1, 2026, 0).waves.flatMap((w) => w.ufoSpecs);
  const stage4Specs = buildSectorCourse(3, 2026, 0).waves.flatMap((w) => w.ufoSpecs);

  const rightRatio = (specs) => specs.filter((u) => u.enterFrom === 'right').length / specs.length;
  const r1 = rightRatio(stage1Specs);
  const r2 = rightRatio(stage2Specs);
  const r4 = rightRatio(stage4Specs);

  assert.ok(r1 > 0 && r1 < 0.35, `Stage 1 has a small fraction of right entries (got ${r1})`);
  assert.ok(r4 > r1, `Right-side entries increase as stages advance (${r1} -> ${r2} -> ${r4})`);
  assert.ok(r4 <= 0.55, 'Majority overall still enter from left');

  // Verify UFOs sweep back and forth across patrol bounds until destroyed rather than exiting
  const state = createGameState({ seed: 2026, sectorIndex: 1 });
  startGame(state, { seed: 2026, sectorIndex: 1 });
  state.course.obstacles = [];
  for (const w of state.course.waves) {
    for (const s of w.ufoSpecs) s.dropsCount = 0;
  }

  while (state.ufos.length === 0) stepGame(state, 0.04);
  const ufo = state.ufos[0];
  let sawRightDir = false;
  let sawLeftDir = false;
  let passedOverPlayer = 0;
  let prevSign = Math.sign(ufo.screenX - state.buggy.screenX);

  for (let i = 0; i < 240; i++) {
    stepGame(state, 0.04);
    if (ufo.dir === 1) sawRightDir = true;
    if (ufo.dir === -1) sawLeftDir = true;
    const sign = Math.sign(ufo.screenX - state.buggy.screenX);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      passedOverPlayer += 1;
    }
    if (sign !== 0) prevSign = sign;
  }

  assert.equal(state.ufos.includes(ufo), true, 'Undestroyed UFO remains active overhead');
  assert.equal(sawRightDir, true);
  assert.equal(sawLeftDir, true, 'UFO reverses direction to patrol back and forth');
  assert.ok(passedOverPlayer >= 2, `UFO passes over player multiple times (got ${passedOverPlayer})`);

  const bugUfo = state.ufos.find((u) => u.kind === 'bug-dropper');
  const cveUfo = state.ufos.find((u) => u.kind === 'cve-bomber');
  if (bugUfo && cveUfo) {
    assert.equal(bugUfo.pattern, 'swoop-wave');
    assert.equal(cveUfo.pattern, 'stalk-hover');
  }
});

test('Stage 1 (A–E) achieves >= 90% completion across 100 seeds with basic player reactions and records full stats', () => {
  let clears = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const state = createGameState({ seed });
    startGame(state, { seed });

    // Simulate a casual human player with imperfect periodic firing and basic crater/rock jumps
    let fireTimer = 0;
    for (let step = 0; step < 2500 && state.status !== 'sector-clear' && state.status !== 'gameover'; step++) {
      if (state.status === 'playing') {
        fireTimer += 0.04;
        // Imperfect player fires only every ~0.55s or when a UFO passes overhead
        const ufoOverhead = state.ufos.some(
          (u) => u.screenX > state.buggy.screenX - 30 && u.screenX < state.buggy.screenX + 20,
        );
        if (fireTimer >= 0.55 || ufoOverhead) {
          fireWeapons(state);
          fireTimer = 0;
        }
        // Jump when an un-destroyed hazard is within casual reaction distance (75px ahead)
        const hazardAhead = state.course.obstacles.some(
          (o) => !o.destroyed && o.x - state.buggy.worldX > 10 && o.x - state.buggy.worldX < 80,
        );
        if (hazardAhead && state.buggy.grounded) {
          requestJump(state);
        }
      }
      stepGame(state, 0.04);
    }

    if (state.status === 'sector-clear') {
      clears += 1;
      const bonus = state.lastSectorBonus;
      assert.equal(bonus.sectorRange, 'A–E');
      assert.ok(bonus.ufosSpawned >= 4);
      assert.ok(bonus.bonus >= 1000);
      if (seed === 1) {
        replayCurrentSector(state);
        assert.equal(state.status, 'playing');
        assert.equal(state.checkpointLetter, 'A');
      }
    }
  }
  assert.ok(clears >= 90, `Expected >= 90% Stage 1 clear rate across 100 seeds, got ${clears}%`);
});
