// Original 8-bit arcade synthesizer for Mona Patrol:
// - Catchy 8-bar chiptune patrol groove (square lead + walking bass + 15-bit LFSR drums)
// - Pronounced, punchy retro arcade sound effects with automatic music ducking
// - Triumphant multi-voice 8-bit musical fanfare passage on round completion

const BPM = 136;
const STEP = 60 / BPM / 4; // 16th-note grid (~0.1103s)
const LOOKAHEAD = 0.14;

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// 64 sixteenth-note steps (4 bars of catchy upbeat arcade patrol melody in A minor / C major)
// Phrase 1: bouncy syncopated call; Phrase 2: heroic rising answer; Phrase 3-4: hook & turnaround
const LEAD_STEPS = [
  // Bar 1 (Am -> G)
  69, null, 72, null, 76, null, 72, 76, 79, null, 76, null, 74, null, 72, null,
  // Bar 2 (F -> E7)
  69, null, 72, 74, 76, null, 81, null, 79, null, 76, 74, 76, null, null, null,
  // Bar 3 (Am -> C)
  76, null, 79, null, 81, null, 79, 76, 72, null, 76, null, 79, null, 84, null,
  // Bar 4 (Dm -> E7 turnaround)
  81, null, 79, 76, 74, null, 76, 74, 72, null, 71, null, 69, null, 76, null,
];

// Counter-harmony stabs on offbeats for rich 2-channel arcade cabinet fullness
const HARMONY_STEPS = [
  null, null, null, null, 60, null, null, null, 64, null, null, null, 62, null, null, null,
  null, null, null, null, 65, null, 69, null, 67, null, null, null, 64, null, null, null,
  null, null, null, null, 69, null, null, null, 64, null, null, null, 67, null, 72, null,
  69, null, null, null, 65, null, null, null, 64, null, 68, null, 64, null, null, null,
];

// Driving 8th-note walking rover bassline (32 eighth notes across 4 bars)
const BASS_EIGHTHS = [
  45, 57, 48, 52, 43, 55, 47, 50,
  41, 53, 45, 48, 40, 52, 44, 47,
  45, 57, 48, 55, 48, 60, 52, 55,
  50, 62, 48, 57, 40, 52, 44, 47,
];

// 16-step drum pattern: 'K' = kick, 'S' = LFSR snare, 'H' = crisp hi-hat
const DRUM_STEPS = [
  'K', 'H', 'H', 'H', 'S', 'H', 'K', 'H',
  'K', 'H', 'K', 'H', 'S', 'H', 'H', 'S',
];

function createLfsrNoiseBuffer(ctx, durationSec = 0.6) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lfsr = 0x7fff;
  // Step LFSR every ~3 samples for gritty 1982 arcade noise texture
  let current = 1;
  for (let i = 0; i < length; i++) {
    if (i % 3 === 0) {
      const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      current = (lfsr & 1) ? 0.9 : -0.9;
    }
    data[i] = current;
  }
  return buffer;
}

export function createAudioController() {
  let enabled = false;
  let playing = false;
  let ctx = null;
  let compressor = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuffer = null;

  let schedulerTimer = null;
  let stepIndex = 0;
  let nextStepTime = 0;
  let fanfareUntil = 0;
  let stageTranspose = 0;
  const STAGE_OFFSETS = [0, 2, 3, 5, 7];
  const activeVoices = new Set();

  function ensureContext() {
    if (!enabled) return null;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;
      compressor.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.24;
      musicBus.connect(compressor);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.46;
      sfxBus.connect(compressor);

      noiseBuffer = createLfsrNoiseBuffer(ctx, 0.7);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function registerVoice(node, gain) {
    const entry = { node, gain };
    activeVoices.add(entry);
    node.onended = () => {
      activeVoices.delete(entry);
      try {
        node.disconnect();
        gain.disconnect();
      } catch {
        // Ignore already-disconnected nodes.
      }
    };
  }

  function clearMusicVoices() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const v of activeVoices) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(0.0001, now);
        v.node.stop(now + 0.01);
      } catch {
        // Ignore stopped voice.
      }
    }
    activeVoices.clear();
  }

  function duckMusic(amount = 0.08, holdSec = 0.18) {
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(amount, now);
    musicBus.gain.linearRampToValueAtTime(0.24, now + holdSec);
  }

  function scheduleOsc({
    bus,
    type = 'square',
    from,
    to = from,
    startTime,
    duration,
    gain = 0.25,
    trackVoice = false,
  }) {
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, from), startTime);
    if (to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, to), startTime + duration);
    }
    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(gain, startTime + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(amp);
    amp.connect(bus);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.012);
    if (trackVoice) registerVoice(osc, amp);
  }

  function scheduleNoise({
    bus,
    startTime,
    duration = 0.12,
    gain = 0.25,
    filterType = 'bandpass',
    freqFrom = 1400,
    freqTo = 400,
    q = 1.2,
    trackVoice = false,
  }) {
    if (!ctx || !bus || !noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqFrom, startTime);
    if (freqTo !== freqFrom) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, freqTo), startTime + duration);
    }
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(gain, startTime + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
    if (trackVoice) registerVoice(src, amp);
  }

  function scheduleGrooveStep(step, time) {
    const idx = step % LEAD_STEPS.length;
    const leadMidi = LEAD_STEPS[idx];
    if (leadMidi !== null) {
      scheduleOsc({
        bus: musicBus,
        type: 'square',
        from: midiToHz(leadMidi + stageTranspose),
        startTime: time,
        duration: STEP * 0.78,
        gain: 0.19,
        trackVoice: true,
      });
    }

    const harmMidi = HARMONY_STEPS[idx];
    if (harmMidi !== null) {
      scheduleOsc({
        bus: musicBus,
        type: 'square',
        from: midiToHz(harmMidi + stageTranspose),
        startTime: time,
        duration: STEP * 0.9,
        gain: 0.1,
        trackVoice: true,
      });
    }

    if (idx % 2 === 0) {
      const bassMidi = BASS_EIGHTHS[(idx / 2) % BASS_EIGHTHS.length];
      scheduleOsc({
        bus: musicBus,
        type: 'triangle',
        from: midiToHz(bassMidi + stageTranspose),
        startTime: time,
        duration: STEP * 1.65,
        gain: 0.34,
        trackVoice: true,
      });
      scheduleOsc({
        bus: musicBus,
        type: 'sawtooth',
        from: midiToHz(bassMidi + stageTranspose),
        startTime: time,
        duration: STEP * 1.1,
        gain: 0.09,
        trackVoice: true,
      });
    }

    const drum = DRUM_STEPS[idx % DRUM_STEPS.length];
    if (drum === 'K') {
      scheduleOsc({
        bus: musicBus,
        type: 'triangle',
        from: 135,
        to: 42,
        startTime: time,
        duration: 0.075,
        gain: 0.32,
        trackVoice: true,
      });
    } else if (drum === 'S') {
      scheduleNoise({
        bus: musicBus,
        startTime: time,
        duration: 0.085,
        gain: 0.18,
        filterType: 'bandpass',
        freqFrom: 2200,
        freqTo: 900,
        q: 0.9,
        trackVoice: true,
      });
    } else if (drum === 'H') {
      scheduleNoise({
        bus: musicBus,
        startTime: time,
        duration: 0.028,
        gain: 0.075,
        filterType: 'highpass',
        freqFrom: 5200,
        freqTo: 5200,
        q: 0.7,
        trackVoice: true,
      });
    }
  }

  function tickScheduler() {
    if (!enabled || !playing || !ctx) return;
    if (ctx.currentTime < fanfareUntil) {
      nextStepTime = Math.max(nextStepTime, fanfareUntil + 0.05);
      return;
    }
    if (nextStepTime < ctx.currentTime) {
      nextStepTime = ctx.currentTime + 0.02;
    }
    while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
      scheduleGrooveStep(stepIndex, nextStepTime);
      nextStepTime += STEP;
      stepIndex += 1;
    }
  }

  function stopLoop() {
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    clearMusicVoices();
  }

  function syncLoop() {
    if (!enabled || !playing) {
      stopLoop();
      return;
    }
    const audio = ensureContext();
    if (!audio) return;
    if (schedulerTimer === null) {
      nextStepTime = audio.currentTime + 0.03;
      schedulerTimer = setInterval(tickScheduler, 30);
      tickScheduler();
    }
  }

  // Triumphant 3-voice 8-bit musical passage when completing Stage A–E (or any sector)
  function playStageClearFanfare() {
    const audio = ensureContext();
    if (!audio) return;
    stopLoop();
    const t0 = audio.currentTime + 0.02;
    fanfareUntil = t0 + 2.75;

    // Crisp snare pickup roll
    for (let r = 0; r < 4; r++) {
      scheduleNoise({
        bus: sfxBus,
        startTime: t0 + r * 0.055,
        duration: 0.05,
        gain: 0.18 + r * 0.03,
        filterType: 'bandpass',
        freqFrom: 2400,
        freqTo: 1200,
      });
    }

    // Triumphant brassy 8-bit melody + major-third harmony + bass cadence
    // [offsetSec, durSec, leadMidi, harmMidi, bassMidi]
    const passage = [
      [0.24, 0.13, 67, 62, 48], // G4
      [0.38, 0.13, 72, 64, null], // C5
      [0.52, 0.13, 76, 67, 52], // E5
      [0.66, 0.28, 79, 72, 55], // G5!
      [0.98, 0.14, 76, 67, null], // E5
      [1.14, 0.32, 79, 72, 48], // G5!
      [1.50, 0.15, 81, 72, 53], // A5
      [1.67, 0.15, 83, 74, 55], // B5
      [1.85, 0.78, 84, 76, 60], // High C6 triumphant hold!
    ];

    for (const [offset, dur, lead, harm, bass] of passage) {
      scheduleOsc({
        bus: sfxBus,
        type: 'square',
        from: midiToHz(lead),
        startTime: t0 + offset,
        duration: dur,
        gain: 0.28,
      });
      if (harm !== null) {
        scheduleOsc({
          bus: sfxBus,
          type: 'square',
          from: midiToHz(harm),
          startTime: t0 + offset,
          duration: dur,
          gain: 0.18,
        });
      }
      if (bass !== null) {
        scheduleOsc({
          bus: sfxBus,
          type: 'triangle',
          from: midiToHz(bass),
          startTime: t0 + offset,
          duration: dur * 1.1,
          gain: 0.34,
        });
      }
    }

    // Sparkling high arpeggio shimmer over the final C major chord
    [72, 76, 79, 84, 88, 91, 96].forEach((m, idx) => {
      scheduleOsc({
        bus: sfxBus,
        type: 'square',
        from: midiToHz(m),
        startTime: t0 + 1.88 + idx * 0.065,
        duration: 0.12,
        gain: 0.14,
      });
    });
  }

  return {
    isEnabled() {
      return enabled;
    },
    setEnabled(next, isCurrentlyPlaying = false) {
      enabled = Boolean(next);
      playing = Boolean(isCurrentlyPlaying);
      if (!enabled) {
        stopLoop();
        if (ctx && ctx.state === 'running') {
          ctx.suspend().catch(() => {});
        }
      } else {
        const audio = ensureContext();
        if (audio) {
          // Confirmation blip when turning sound on so the player hears immediate feedback
          const t = audio.currentTime + 0.01;
          scheduleOsc({ bus: sfxBus, type: 'square', from: 523.25, startTime: t, duration: 0.06, gain: 0.2 });
          scheduleOsc({ bus: sfxBus, type: 'square', from: 783.99, startTime: t + 0.06, duration: 0.09, gain: 0.22 });
        }
        syncLoop();
      }
      return enabled;
    },
    syncPlaying(isCurrentlyPlaying, sectorIndex = 0) {
      stageTranspose = STAGE_OFFSETS[sectorIndex % STAGE_OFFSETS.length] ?? 0;
      playing = Boolean(isCurrentlyPlaying);
      syncLoop();
    },
    playEvent(event) {
      const audio = ensureContext();
      if (!enabled || !audio || !sfxBus) return;
      const now = audio.currentTime + 0.005;

      switch (event.type) {
        case 'jump':
          duckMusic(0.14, 0.16);
          scheduleOsc({
            bus: sfxBus,
            type: 'square',
            from: 165,
            to: 610,
            startTime: now,
            duration: 0.21,
            gain: 0.3,
          });
          scheduleOsc({
            bus: sfxBus,
            type: 'triangle',
            from: 110,
            to: 340,
            startTime: now,
            duration: 0.19,
            gain: 0.28,
          });
          break;

        case 'fire':
          scheduleOsc({
            bus: sfxBus,
            type: 'square',
            from: 1320,
            to: 195,
            startTime: now,
            duration: 0.1,
            gain: 0.26,
          });
          scheduleOsc({
            bus: sfxBus,
            type: 'square',
            from: 740,
            to: 1080,
            startTime: now + 0.015,
            duration: 0.065,
            gain: 0.15,
          });
          scheduleNoise({
            bus: sfxBus,
            startTime: now,
            duration: 0.022,
            gain: 0.14,
            filterType: 'highpass',
            freqFrom: 3200,
            freqTo: 1800,
          });
          break;

        case 'rock-damaged':
          duckMusic(0.12, 0.12);
          scheduleOsc({
            bus: sfxBus,
            type: 'square',
            from: 640,
            to: 310,
            startTime: now,
            duration: 0.085,
            gain: 0.28,
          });
          scheduleNoise({
            bus: sfxBus,
            startTime: now,
            duration: 0.06,
            gain: 0.2,
            filterType: 'bandpass',
            freqFrom: 2200,
            freqTo: 800,
          });
          break;

        case 'rock-destroyed':
        case 'bomb-destroyed':
        case 'cve-destroyed':
          duckMusic(0.08, 0.24);
          scheduleNoise({
            bus: sfxBus,
            startTime: now,
            duration: 0.25,
            gain: 0.38,
            filterType: 'lowpass',
            freqFrom: 1800,
            freqTo: 180,
            q: 1.5,
          });
          scheduleOsc({
            bus: sfxBus,
            type: 'sawtooth',
            from: 210,
            to: 46,
            startTime: now,
            duration: 0.24,
            gain: 0.32,
          });
          if (event.type === 'cve-destroyed') {
            scheduleOsc({
              bus: sfxBus,
              type: 'square',
              from: 659.25,
              to: 987.77,
              startTime: now + 0.05,
              duration: 0.11,
              gain: 0.22,
            });
          }
          break;

        case 'cve-dropped':
          scheduleOsc({
            bus: sfxBus,
            type: 'square',
            from: 880,
            to: 440,
            startTime: now,
            duration: 0.12,
            gain: 0.17,
          });
          break;

        case 'crater-carved':
          duckMusic(0.07, 0.28);
          scheduleNoise({
            bus: sfxBus,
            startTime: now,
            duration: 0.32,
            gain: 0.4,
            filterType: 'lowpass',
            freqFrom: 950,
            freqTo: 95,
            q: 2.0,
          });
          scheduleOsc({
            bus: sfxBus,
            type: 'triangle',
            from: 130,
            to: 34,
            startTime: now,
            duration: 0.3,
            gain: 0.36,
          });
          break;

        case 'rolling-stone':
          scheduleOsc({
            bus: sfxBus,
            type: 'triangle',
            from: 95,
            to: 140,
            startTime: now,
            duration: 0.14,
            gain: 0.22,
          });
          break;

        case 'ufo-destroyed':
        case 'wave-cleared':
          duckMusic(0.06, 0.32);
          [980, 760, 580, 430, 300, 190].forEach((hz, idx) => {
            scheduleOsc({
              bus: sfxBus,
              type: 'square',
              from: hz,
              to: hz * 0.85,
              startTime: now + idx * 0.036,
              duration: 0.045,
              gain: 0.28,
            });
          });
          scheduleNoise({
            bus: sfxBus,
            startTime: now + 0.04,
            duration: 0.26,
            gain: 0.34,
            filterType: 'bandpass',
            freqFrom: 1600,
            freqTo: 240,
          });
          if (event.type === 'wave-cleared') {
            [523.25, 659.25, 783.99, 1046.5].forEach((hz, idx) => {
              scheduleOsc({
                bus: sfxBus,
                type: 'square',
                from: hz,
                startTime: now + 0.22 + idx * 0.065,
                duration: 0.09,
                gain: 0.24,
              });
            });
          }
          break;

        case 'checkpoint':
        case 'extra-life':
          duckMusic(0.08, 0.36);
          [523.25, 659.25, 783.99, 1046.5].forEach((hz, idx) => {
            scheduleOsc({
              bus: sfxBus,
              type: 'square',
              from: hz,
              startTime: now + idx * 0.075,
              duration: idx === 3 ? 0.2 : 0.085,
              gain: 0.28,
            });
          });
          break;

        case 'sector-clear':
          playStageClearFanfare();
          break;

        case 'crash':
          duckMusic(0.04, 0.5);
          scheduleNoise({
            bus: sfxBus,
            startTime: now,
            duration: 0.46,
            gain: 0.44,
            filterType: 'lowpass',
            freqFrom: 1500,
            freqTo: 110,
            q: 1.8,
          });
          scheduleOsc({
            bus: sfxBus,
            type: 'sawtooth',
            from: 185,
            to: 34,
            startTime: now,
            duration: 0.44,
            gain: 0.36,
          });
          break;

        default:
          break;
      }
    },
    dispose() {
      stopLoop();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
