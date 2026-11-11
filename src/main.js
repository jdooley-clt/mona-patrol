import {
  GEARS,
  advanceToNextSector,
  createGameState,
  fireWeapons,
  replayCurrentSector,
  requestJump,
  selectStartSector,
  shiftGear,
  startGame,
  stepGame,
  togglePause,
} from './engine.js';
import { renderGame } from './renderer.js';
import { createAudioController } from './audio.js';

const BEST_SCORE_KEY = 'mona-patrol-best';
const THEME_KEY = 'mona-patrol-theme';

function loadBestScore() {
  try {
    const raw = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(score)));
  } catch {
    // Ignore storage quota or sandbox errors.
  }
}

function detectEmbedded() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

const arcadeLink = document.getElementById('arcade-link');
const sourceLink = document.getElementById('source-link');
const themeBtn = document.getElementById('theme');
const audioBtn = document.getElementById('audio-toggle');
const helpBtn = document.getElementById('help');
const pauseBtn = document.getElementById('pause');
const restartBtn = document.getElementById('restart');
const primaryBtn = document.getElementById('primary');
const replaySectorBtn = document.getElementById('replay-sector');
const overlayAudioBtn = document.getElementById('overlay-audio');

const stageEl = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const overlayEl = document.getElementById('overlay');
const overlayKicker = document.getElementById('overlay-kicker');
const overlayTitle = document.getElementById('overlay-title');
const overlayDetail = document.getElementById('overlay-detail');
const statsGrid = document.getElementById('stats-grid');
const statTime = document.getElementById('stat-time');
const statUfos = document.getElementById('stat-ufos');
const statRocks = document.getElementById('stat-rocks');
const statJumps = document.getElementById('stat-jumps');
const statAccuracy = document.getElementById('stat-accuracy');
const statBonus = document.getElementById('stat-bonus');
const stagePickerEl = document.getElementById('stage-picker');
const stagePillBtns = [...document.querySelectorAll('.stage-pill')];
const announcerEl = document.getElementById('announcer');

const checkpointEl = document.getElementById('checkpoint');
const livesEl = document.getElementById('lives');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const btnSlower = document.getElementById('btn-slower');
const btnFaster = document.getElementById('btn-faster');
const btnJump = document.getElementById('btn-jump');
const btnFire = document.getElementById('btn-fire');

const helpDialog = document.getElementById('help-dialog');
const closeHelpBtn = document.getElementById('close-help');
const gotItBtn = document.getElementById('got-it');

if (!detectEmbedded()) {
  arcadeLink.hidden = false;
  sourceLink.hidden = false;
}

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (e) => {
  reducedMotion = e.matches;
  syncDom();
});

const audio = createAudioController();
const state = createGameState({ bestScore: loadBestScore() });

let jumpsFired = 0;
let shotsFired = 0;
let resumeAfterHelp = false;
let rafId = 0;
let lastFrameTime = performance.now();

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function syncThemeButton() {
  const dark = currentTheme() === 'dark';
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.textContent = dark ? 'Light mode' : 'Dark mode';
}

function syncAudioButton() {
  const on = audio.isEnabled();
  audioBtn.setAttribute('aria-pressed', String(on));
  audioBtn.textContent = on ? 'Audio: on' : 'Audio: off';
  overlayAudioBtn.setAttribute('aria-pressed', String(on));
  overlayAudioBtn.textContent = on ? 'Sound: on (M)' : 'Sound: off (M)';
}

function announce(message) {
  announcerEl.textContent = '';
  requestAnimationFrame(() => {
    announcerEl.textContent = message;
  });
}

function syncStagePills() {
  const active = state.selectedSector ?? state.sectorIndex ?? 0;
  for (const btn of stagePillBtns) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.sectorPick) === active));
  }
}

function syncOverlay() {
  syncStagePills();
  if (state.status === 'ready') {
    overlayEl.hidden = false;
    statsGrid.hidden = true;
    stagePickerEl.hidden = false;
    replaySectorBtn.hidden = true;
    overlayAudioBtn.hidden = false;
    overlayKicker.textContent = `CHECKPOINT ${state.checkpointLetter} — ${(state.course.themeTitle || state.course.sectorName).toUpperCase()}`;
    overlayTitle.textContent = 'Patrol the lunar ridge.';
    overlayDetail.textContent =
      'Leap craters and mines, blast boulders and rolling stones, and clear Bug-Dropper & CVE saucers overhead.';
    primaryBtn.innerHTML = 'Start patrol <span aria-hidden="true">→</span>';
  } else if (state.status === 'paused') {
    overlayEl.hidden = false;
    statsGrid.hidden = true;
    stagePickerEl.hidden = true;
    replaySectorBtn.hidden = true;
    overlayAudioBtn.hidden = false;
    overlayKicker.textContent = `PAUSED AT POINT ${state.checkpointLetter}`;
    overlayTitle.textContent = 'Patrol paused.';
    overlayDetail.textContent =
      'Press Space, Enter, or P to resume driving from your current position.';
    primaryBtn.innerHTML = 'Resume patrol <span aria-hidden="true">→</span>';
  } else if (state.status === 'sector-clear' && state.lastSectorBonus) {
    const s = state.lastSectorBonus;
    overlayEl.hidden = false;
    statsGrid.hidden = false;
    stagePickerEl.hidden = true;
    replaySectorBtn.hidden = false;
    overlayAudioBtn.hidden = true;
    replaySectorBtn.textContent = `Replay ${s.sectorRange}`;
    overlayKicker.textContent = `STAGE ${s.sectorRange} COMPLETE — ${(s.themeTitle || s.sectorName).toUpperCase()}`;
    overlayTitle.textContent =
      s.flawlessBonus > 0
        ? `Flawless patrol! +${s.bonus} pts`
        : `Checkpoint ${s.letter} reached! +${s.bonus} pts`;
    overlayDetail.textContent = `Target par ${s.parSeconds}s · ${s.livesRemaining} buggies ready · Total score ${String(s.totalScore).padStart(5, '0')}`;
    statTime.textContent = `${s.seconds.toFixed(1)}s / ${s.parSeconds}s`;
    statUfos.textContent = `${s.ufosDestroyed} / ${s.ufosSpawned}`;
    statRocks.textContent = String(s.rocksDestroyed);
    statJumps.textContent = String(s.hazardsJumped);
    statAccuracy.textContent = `${s.accuracyPct}% (${s.shotsHit}/${s.shotsFired})`;
    statBonus.textContent = `+${s.bonus}`;
    primaryBtn.innerHTML = 'Next stage <span aria-hidden="true">→</span>';
  } else if (state.status === 'gameover') {
    overlayEl.hidden = false;
    statsGrid.hidden = true;
    stagePickerEl.hidden = false;
    replaySectorBtn.hidden = true;
    overlayAudioBtn.hidden = false;
    overlayKicker.textContent = `REACHED CHECKPOINT ${state.checkpointLetter}`;
    overlayTitle.textContent = `Patrol over — ${String(state.score).padStart(5, '0')} pts`;
    overlayDetail.textContent = `Stopped by ${state.crashReason || 'lunar hazard'}. Best score: ${String(state.bestScore).padStart(5, '0')}.`;
    primaryBtn.innerHTML = 'Patrol again <span aria-hidden="true">→</span>';
  } else {
    overlayEl.hidden = true;
  }
}

function syncDom() {
  const gear = GEARS[state.gearIndex];
  checkpointEl.textContent = `${state.checkpointLetter} · ${state.course.sectorName.toUpperCase()}`;
  const icons = '▲'.repeat(Math.min(5, state.lives)) || '—';
  livesEl.textContent = `${icons} (${state.lives})`;
  timerEl.textContent = `${state.sectorElapsed.toFixed(1).padStart(4, '0')}s`;
  scoreEl.textContent = String(state.score).padStart(5, '0');
  bestEl.textContent = String(state.bestScore).padStart(5, '0');

  const canPause = state.status === 'playing' || state.status === 'paused';
  pauseBtn.disabled = !canPause;
  pauseBtn.setAttribute('aria-pressed', String(state.status === 'paused'));
  pauseBtn.textContent = state.status === 'paused' ? 'Resume' : 'Pause';

  stageEl.dataset.status = state.status;
  stageEl.dataset.checkpoint = state.checkpointLetter;
  stageEl.dataset.sector = state.course.sectorName;
  stageEl.dataset.gear = gear.id;
  stageEl.dataset.speed = String(Math.round(state.speed));
  stageEl.dataset.worldX = String(Math.round(state.buggy.worldX));
  stageEl.dataset.grounded = String(state.buggy.grounded);
  stageEl.dataset.jumps = String(jumpsFired);
  stageEl.dataset.shotsFired = String(shotsFired);
  stageEl.dataset.score = String(state.score);
  stageEl.dataset.lives = String(state.lives);
  stageEl.dataset.elapsed = state.elapsed.toFixed(1);
  stageEl.dataset.reducedMotion = String(reducedMotion);

  syncOverlay();
}

function drainEvents() {
  if (state.bestScore > loadBestScore()) {
    saveBestScore(state.bestScore);
  }
  while (state.events.length > 0) {
    const ev = state.events.shift();
    audio.playEvent(ev);
    if (ev.type === 'jump') jumpsFired += 1;
    if (ev.type === 'fire') shotsFired += 1;
    if (ev.type === 'started') {
      announce(`Patrol started at Checkpoint ${ev.checkpoint}. Score 0.`);
    } else if (ev.type === 'checkpoint') {
      announce(`Checkpoint ${ev.checkpoint} reached! Score ${state.score}.`);
    } else if (ev.type === 'sector-clear') {
      const st = ev.stats;
      announce(
        `Stage ${st.sectorRange} cleared in ${ev.seconds.toFixed(1)} seconds! UFOs eliminated ${st.ufosDestroyed} of ${st.ufosSpawned}, boulders blasted ${st.rocksDestroyed}, bonus ${ev.bonus} points. Total score ${state.score}.`,
      );
      syncDom();
      primaryBtn.focus({ preventScroll: true });
    } else if (ev.type === 'respawn') {
      announce(`${ev.lives} buggies left. Respawning at Checkpoint ${ev.checkpoint}.`);
    } else if (ev.type === 'extra-life') {
      announce(`Extra lunar buggy earned! ${ev.lives} buggies available.`);
    } else if (ev.type === 'paused') {
      announce('Patrol paused.');
    } else if (ev.type === 'resumed') {
      announce('Patrol resumed.');
    } else if (ev.type === 'gameover') {
      announce(
        `Game over at Checkpoint ${ev.checkpoint}. Final score ${ev.score}. Best score ${ev.bestScore}.`,
      );
      syncDom();
      primaryBtn.focus({ preventScroll: true });
    }
  }
  audio.syncPlaying(state.status === 'playing', state.sectorIndex);
}

function beginOrResumePatrol() {
  if (state.status === 'ready' || state.status === 'gameover') {
    jumpsFired = 0;
    shotsFired = 0;
    startGame(state);
    drainEvents();
    syncDom();
    stageEl.focus({ preventScroll: true });
  } else if (state.status === 'paused') {
    togglePause(state);
    drainEvents();
    syncDom();
    stageEl.focus({ preventScroll: true });
  } else if (state.status === 'sector-clear') {
    advanceToNextSector(state);
    drainEvents();
    syncDom();
    stageEl.focus({ preventScroll: true });
  }
}

function pauseIfPlaying() {
  if (state.status === 'playing') {
    togglePause(state, true);
    if (reducedMotion && state.crashTimer > 0.35) {
      state.crashTimer = 0.35;
    }
    drainEvents();
    syncDom();
  }
}

primaryBtn.addEventListener('click', () => {
  beginOrResumePatrol();
});

replaySectorBtn.addEventListener('click', () => {
  replayCurrentSector(state);
  drainEvents();
  syncDom();
  stageEl.focus({ preventScroll: true });
});

function toggleSound() {
  audio.setEnabled(!audio.isEnabled(), state.status === 'playing');
  syncAudioButton();
  announce(audio.isEnabled() ? 'Audio on.' : 'Audio muted.');
}

overlayAudioBtn.addEventListener('click', toggleSound);

for (const btn of stagePillBtns) {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.sectorPick);
    selectStartSector(state, idx);
    syncDom();
    renderGame(canvas, state, { theme: currentTheme(), reducedMotion });
    primaryBtn.focus({ preventScroll: true });
  });
}

pauseBtn.addEventListener('click', () => {
  if (state.status === 'playing' || state.status === 'paused') {
    togglePause(state);
    drainEvents();
    syncDom();
    if (state.status === 'playing') {
      stageEl.focus({ preventScroll: true });
    }
  }
});

restartBtn.addEventListener('click', () => {
  jumpsFired = 0;
  shotsFired = 0;
  startGame(state);
  drainEvents();
  syncDom();
  stageEl.focus({ preventScroll: true });
});

themeBtn.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Ignore storage failure.
  }
  syncThemeButton();
  renderGame(canvas, state, { theme: currentTheme(), reducedMotion });
});

audioBtn.addEventListener('click', toggleSound);

function openHelp() {
  resumeAfterHelp = state.status === 'playing';
  if (resumeAfterHelp) {
    togglePause(state, true);
    drainEvents();
    syncDom();
  }
  if (!helpDialog.open) {
    helpDialog.showModal();
    closeHelpBtn.focus({ preventScroll: true });
  }
}

function closeHelp() {
  if (helpDialog.open) {
    helpDialog.close();
  }
  if (resumeAfterHelp && state.status === 'paused') {
    resumeAfterHelp = false;
    togglePause(state);
    drainEvents();
    syncDom();
    stageEl.focus({ preventScroll: true });
  } else {
    resumeAfterHelp = false;
  }
}

helpBtn.addEventListener('click', openHelp);
closeHelpBtn.addEventListener('click', closeHelp);
gotItBtn.addEventListener('click', closeHelp);
helpDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeHelp();
});

// Touch / pointer pad bindings
function bindPadButton(button, onPress, onRelease) {
  let activePointer = null;

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointer = event.pointerId;
    button.dataset.active = 'true';
    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events may not capture pointers.
      }
    }
    onPress();
    drainEvents();
    syncDom();
  });

  const endPress = (event) => {
    if (activePointer !== null && event.pointerId !== undefined && event.pointerId !== activePointer) {
      return;
    }
    activePointer = null;
    delete button.dataset.active;
    if (onRelease) {
      onRelease();
      syncDom();
    }
  };

  button.addEventListener('pointerup', endPress);
  button.addEventListener('pointercancel', endPress);
  button.addEventListener('lostpointercapture', endPress);

  // Keyboard activation fallback (`Enter` on focused pad button)
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    onPress();
    if (onRelease) onRelease();
    drainEvents();
    syncDom();
  });
}

bindPadButton(
  btnSlower,
  () => {
    if (state.status !== 'playing') return;
    shiftGear(state, -1);
    state.input.brake = true;
  },
  () => {
    state.input.brake = false;
  },
);

bindPadButton(
  btnFaster,
  () => {
    if (state.status !== 'playing') return;
    shiftGear(state, 1);
    state.input.accelerate = true;
  },
  () => {
    state.input.accelerate = false;
  },
);

bindPadButton(
  btnJump,
  () => {
    if (state.status === 'ready') {
      beginOrResumePatrol();
      return;
    }
    requestJump(state);
    state.input.jumpHeld = true;
  },
  () => {
    state.input.jumpHeld = false;
  },
);

bindPadButton(
  btnFire,
  () => {
    if (state.status !== 'playing') return;
    fireWeapons(state);
    state.input.fireHeld = true;
  },
  () => {
    state.input.fireHeld = false;
  },
);

// Keyboard controls — standalone anchors keep native browser behavior.
window.addEventListener('keydown', (event) => {
  if (event.altKey || event.metaKey) return;
  if (helpDialog.open) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeHelp();
    }
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('a[href]')) {
    return;
  }

  const key = event.key;
  const lower = key.toLowerCase();

  if (key === ' ' || key === 'Spacebar') {
    event.preventDefault();
    if (state.status === 'ready' || state.status === 'paused' || state.status === 'gameover' || state.status === 'sector-clear') {
      beginOrResumePatrol();
    } else if (state.status === 'playing' && !event.repeat) {
      requestJump(state);
      state.input.jumpHeld = true;
      drainEvents();
      syncDom();
    }
    return;
  }

  if (key === 'Enter') {
    // Let focused toolbar/help buttons handle Enter natively, except `#primary` or `#stage`.
    if (target && target.tagName === 'BUTTON' && target !== primaryBtn) {
      return;
    }
    event.preventDefault();
    beginOrResumePatrol();
    return;
  }

  if (key === 'ArrowUp' || lower === 'w') {
    event.preventDefault();
    if (!event.repeat) {
      requestJump(state);
      state.input.jumpHeld = true;
      drainEvents();
      syncDom();
    }
    return;
  }

  if (key === 'ArrowRight' || lower === 'd') {
    event.preventDefault();
    if (state.status === 'playing') {
      if (!event.repeat) shiftGear(state, 1);
      state.input.accelerate = true;
      drainEvents();
      syncDom();
    }
    return;
  }

  if (key === 'ArrowLeft' || lower === 'a') {
    event.preventDefault();
    if (state.status === 'playing') {
      if (!event.repeat) shiftGear(state, -1);
      state.input.brake = true;
      drainEvents();
      syncDom();
    }
    return;
  }

  if (key === 'ArrowDown' || lower === 's') {
    event.preventDefault();
    return;
  }

  if (lower === 'z' || lower === 'x' || key === 'Control') {
    event.preventDefault();
    if (state.status === 'playing') {
      fireWeapons(state);
      state.input.fireHeld = true;
      drainEvents();
      syncDom();
    }
    return;
  }

  if ((lower === 'p' || key === 'Escape') && !event.repeat) {
    if (state.status === 'playing' || state.status === 'paused') {
      event.preventDefault();
      togglePause(state);
      drainEvents();
      syncDom();
    }
    return;
  }

  if (lower === 'm' && !event.repeat) {
    event.preventDefault();
    audio.setEnabled(!audio.isEnabled(), state.status === 'playing');
    syncAudioButton();
    announce(audio.isEnabled() ? 'Audio on.' : 'Audio muted.');
    return;
  }

  if (lower === 'r' && !event.repeat) {
    event.preventDefault();
    jumpsFired = 0;
    shotsFired = 0;
    startGame(state);
    drainEvents();
    syncDom();
    stageEl.focus({ preventScroll: true });
    return;
  }

  if (key === '?' && !event.repeat) {
    event.preventDefault();
    openHelp();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key;
  const lower = key.toLowerCase();
  if (key === 'ArrowRight' || lower === 'd') state.input.accelerate = false;
  if (key === 'ArrowLeft' || lower === 'a') state.input.brake = false;
  if (key === ' ' || key === 'ArrowUp' || lower === 'w') state.input.jumpHeld = false;
  if (lower === 'z' || lower === 'x' || key === 'Control') state.input.fireHeld = false;
});

// Optional gamepad support
let prevPadButtons = [];
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const pad = pads && pads[0];
  if (!pad) return;

  const pressed = (idx) => Boolean(pad.buttons[idx]?.pressed);
  const justPressed = (idx) => pressed(idx) && !prevPadButtons[idx];

  const axisX = pad.axes[0] ?? 0;
  if (justPressed(9)) {
    if (state.status === 'ready' || state.status === 'gameover') beginOrResumePatrol();
    else togglePause(state);
  }
  if (state.status === 'playing') {
    if (justPressed(15) || (axisX > 0.55 && !state.input.accelerate)) {
      shiftGear(state, 1);
      state.input.accelerate = true;
    } else if (axisX <= 0.3 && !pressed(15)) {
      state.input.accelerate = false;
    }
    if (justPressed(14) || (axisX < -0.55 && !state.input.brake)) {
      shiftGear(state, -1);
      state.input.brake = true;
    } else if (axisX >= -0.3 && !pressed(14)) {
      state.input.brake = false;
    }
    if (justPressed(0) || justPressed(12)) requestJump(state);
    if (pressed(1) || pressed(2) || pressed(7)) fireWeapons(state);
  }

  prevPadButtons = pad.buttons.map((b) => Boolean(b?.pressed));
}

// Pause automatically on window blur or tab visibility loss
window.addEventListener('blur', pauseIfPlaying);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseIfPlaying();
});

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(rafId);
  audio.dispose();
});

function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;

  pollGamepad();
  stepGame(state, dt);
  if (reducedMotion && state.status === 'crashing' && state.crashTimer > 0.35) {
    state.crashTimer = 0.35;
  }
  drainEvents();
  syncDom();
  renderGame(canvas, state, { theme: currentTheme(), reducedMotion });

  rafId = requestAnimationFrame(tick);
}

// Deterministic step hook for automated verification and capture staging
window.__monaPatrol = {
  getState: () => state,
  advance(ms) {
    const steps = Math.max(1, Math.ceil(ms / 16));
    const stepDt = ms / 1000 / steps;
    for (let i = 0; i < steps; i++) {
      stepGame(state, stepDt);
      drainEvents();
    }
    syncDom();
    renderGame(canvas, state, { theme: currentTheme(), reducedMotion });
  },
};

syncThemeButton();
syncAudioButton();
syncDom();
renderGame(canvas, state, { theme: currentTheme(), reducedMotion });
rafId = requestAnimationFrame(tick);
