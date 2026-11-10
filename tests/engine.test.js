import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKPOINTS,
  EXTRA_LIFE_SCORE,
  GEARS,
  GROUND_Y,
  PAR_SECONDS,
  SECTION_LENGTH,
  advanceToNextSector,
  buildSectorCourse,
  createGameState,
  fireWeapons,
  generateCourseSection,
  groundYAt,
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
  assert.ok(first.obstacles.length >= 3, 'leg has multiple hazards');
  assert.ok(first.waves.length >= 1, 'leg schedules at least one UFO wave');

  for (let i = 0; i < first.obstacles.length; i++) {
    const obs = first.obstacles[i];
    assert.ok(obs.x >= 300, 'safe spawn runway after gate');
    assert.ok(obs.x + obs.width <= SECTION_LENGTH - 200, 'safe approach before next gate');
    if (i > 0) {
      const prev = first.obstacles[i - 1];
      const gap = obs.x - (prev.x + prev.width);
      assert.ok(gap >= 220, `obstacles maintain jumpable gap (got ${gap})`);
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
