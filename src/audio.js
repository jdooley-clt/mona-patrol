// Original synthesized Web Audio effects and lunar bassline pulse for Mona Patrol.
// Audio always starts muted/disabled until explicitly enabled by the player.

export function createAudioController() {
  let enabled = false;
  let ctx = null;
  let master = null;
  let pulseTimer = null;
  let stepIndex = 0;

  const BASS_STEPS = [110, 110, 146.83, 130.81, 110, 110, 164.81, 146.83];

  function ensureContext() {
    if (!enabled) return null;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone({ type = 'square', from, to = from, duration = 0.1, gain = 0.22, delay = 0 }) {
    const audio = ensureContext();
    if (!audio || !master) return;
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  function stopBeat() {
    if (pulseTimer !== null) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  function syncBeat(isPlaying) {
    if (!enabled || !isPlaying) {
      stopBeat();
      return;
    }
    if (pulseTimer !== null) return;
    pulseTimer = setInterval(() => {
      if (!enabled) return;
      const freq = BASS_STEPS[stepIndex % BASS_STEPS.length];
      stepIndex += 1;
      tone({ type: 'triangle', from: freq, to: freq * 0.96, duration: 0.11, gain: 0.11 });
    }, 210);
  }

  return {
    isEnabled() {
      return enabled;
    },
    setEnabled(next, isPlaying = false) {
      enabled = Boolean(next);
      if (!enabled) {
        stopBeat();
        if (ctx && ctx.state === 'running') {
          ctx.suspend().catch(() => {});
        }
      } else {
        ensureContext();
        syncBeat(isPlaying);
      }
      return enabled;
    },
    syncPlaying(isPlaying) {
      syncBeat(isPlaying);
    },
    playEvent(event) {
      if (!enabled) return;
      switch (event.type) {
        case 'jump':
          tone({ type: 'triangle', from: 190, to: 430, duration: 0.16, gain: 0.24 });
          break;
        case 'fire':
          tone({ type: 'square', from: 760, to: 260, duration: 0.08, gain: 0.16 });
          break;
        case 'rock-damaged':
          tone({ type: 'sawtooth', from: 220, to: 140, duration: 0.07, gain: 0.18 });
          break;
        case 'rock-destroyed':
        case 'bomb-destroyed':
          tone({ type: 'sawtooth', from: 260, to: 85, duration: 0.15, gain: 0.24 });
          break;
        case 'ufo-destroyed':
        case 'wave-cleared':
          tone({ type: 'square', from: 520, to: 880, duration: 0.11, gain: 0.2 });
          tone({ type: 'square', from: 660, to: 1040, duration: 0.14, gain: 0.2, delay: 0.08 });
          break;
        case 'checkpoint':
        case 'extra-life':
          tone({ type: 'triangle', from: 523.25, to: 523.25, duration: 0.1, gain: 0.24 });
          tone({ type: 'triangle', from: 659.25, to: 659.25, duration: 0.12, gain: 0.24, delay: 0.09 });
          tone({ type: 'triangle', from: 783.99, to: 783.99, duration: 0.18, gain: 0.25, delay: 0.18 });
          break;
        case 'sector-clear':
          [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) => {
            tone({ type: 'triangle', from: n, to: n, duration: 0.15, gain: 0.26, delay: idx * 0.1 });
          });
          break;
        case 'crash':
          tone({ type: 'sawtooth', from: 180, to: 42, duration: 0.36, gain: 0.3 });
          break;
        default:
          break;
      }
    },
    dispose() {
      stopBeat();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
