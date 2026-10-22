/**
 * The background ambience: a continuous sound that plays while a session
 * runs.
 *
 * Like the completion cues, the ambience is *synthesised* rather than
 * shipped as an audio file. That keeps the bundle small and means the
 * ambience can be shaped — the rain is filtered noise, the waves are noise
 * under a slow swell — rather than being a file the user cannot adjust.
 *
 * The sound is built on the *shared* AudioContext, so the cue and the
 * ambience are scheduled against one clock. A second context would mean a
 * second clock, and a browser limits how many a page may open.
 *
 * The ambience is stopped as soon as the phase is not running. A timer that
 * keeps making noise after it has stopped is a timer the user has to
 * silence, which is worse than a timer that is merely quiet.
 */

import type { AmbienceId } from '@/domain/ambience';
import { getAudioContext } from './audio';

/** How long the noise buffer is, in seconds. */
const NOISE_SECONDS = 4;

/** The volume the whole ambience is mixed at before the user's own level. */
const MASTER_GAIN = 0.5;

/**
 * The running ambience, if there is one.
 *
 * It is held at module scope rather than in React state because it is a
 * *sound*, not a piece of the interface: it has to survive a re-render and
 * be stopped exactly once.
 */
interface AmbienceSession {
  /** The sources and nodes that have to be stopped and disconnected. */
  readonly nodes: readonly AudioScheduledSourceNode[];
  /** The gain the user's volume is applied to. */
  readonly gain: GainNode;
  /** The timer that schedules the forest's birdsong, if it is playing. */
  readonly timer: number | null;
  /**
   * Releases everything the ambience made beyond its long-lived sources.
   *
   * The builders create nodes *while they play* — a crack in the fire, a
   * chirp in the forest — and those have to be given back when the
   * ambience stops, or the graph grows for as long as the app is open.
   */
  readonly release: () => void;
}

let session: AmbienceSession | null = null;

/**
 * Counts the ambiences that have been asked for.
 *
 * The start is asynchronous — a suspended context has to be resumed before
 * it can play — and a resume that finishes after the user has already
 * asked for something else must not start the wrong ambience.
 */
let generation = 0;

/**
 * Fills a buffer with noise of the given colour.
 *
 * White noise is every frequency at once, which sounds like a hiss. Brown
 * noise is the same noise integrated over time, which removes most of the
 * high frequencies and sounds like distant water. The ambience is built from
 * one of the two, filtered to taste.
 */
function fillNoise(context: AudioContext, brown: boolean): AudioBuffer {
  const frames = Math.floor(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);

  let last = 0;

  for (let index = 0; index < frames; index += 1) {
    const white = Math.random() * 2 - 1;

    if (brown) {
      // The leak is what makes it brown: without it the running sum would
      // drift away and clip.
      last = (last + 0.02 * white) / 1.02;
      channel[index] = last * 3.5;
    } else {
      channel[index] = white;
    }
  }

  return buffer;
}

/**
 * Starts a looping noise source.
 *
 * The buffer is looped rather than restarted, because a restart is a click:
 * the seam between two buffers is a discontinuity, and a discontinuity in a
 * continuous background sound is very audible.
 */
function startNoise(
  context: AudioContext,
  destination: AudioNode,
  brown: boolean,
): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = fillNoise(context, brown);
  source.loop = true;
  source.connect(destination);
  source.start();

  return source;
}

/**
 * Starts the brown noise: the deep end of the spectrum, and almost nothing
 * above it.
 *
 * Brown noise is the same noise integrated over time, which removes most of
 * the high frequencies. It is the sound of distant water, and it is the one
 * that masks a room without being noticed as sound.
 */
function buildBrown(context: AudioContext, destination: AudioNode): AudioScheduledSourceNode[] {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 420;

  lowpass.connect(destination);

  return [startNoise(context, lowpass, true)];
}

/**
 * Starts the white noise: every frequency at once, gently rolled off.
 *
 * The roll-off is deliberate. Unfiltered white noise is a hiss that gets
 * tiring within minutes, and the top end is the part the ear notices; taking
 * it off leaves the masking quality without the sharpness.
 */
function buildWhite(context: AudioContext, destination: AudioNode): AudioScheduledSourceNode[] {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 6_500;

  const gain = context.createGain();
  gain.gain.value = 0.35;

  lowpass.connect(gain);
  gain.connect(destination);

  return [startNoise(context, lowpass, false)];
}

/**
 * Starts the rain: white noise, with the hiss taken off and the body kept.
 */
function buildRain(context: AudioContext, destination: AudioNode): AudioScheduledSourceNode[] {
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 700;

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 6_000;

  const body = context.createGain();
  body.gain.value = 0.5;

  highpass.connect(lowpass);
  lowpass.connect(body);
  body.connect(destination);

  return [startNoise(context, highpass, false)];
}

/**
 * Starts the waves: brown noise under a slow swell.
 *
 * The swell is an oscillator wired into the gain, rather than a value that
 * is written on a timer. An oscillator keeps its own phase, so the waves do
 * not restart from the beginning every time the page is shown.
 */
function buildWaves(context: AudioContext, destination: AudioNode): AudioScheduledSourceNode[] {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 900;

  const swell = context.createGain();
  swell.gain.value = 0.35;

  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 0.09;

  const swellDepth = context.createGain();
  swellDepth.gain.value = 0.3;

  oscillator.connect(swellDepth);
  swellDepth.connect(swell.gain);

  lowpass.connect(swell);
  swell.connect(destination);

  oscillator.start();

  return [startNoise(context, lowpass, true), oscillator];
}

/**
 * Starts the forest: a low bed of wind, with birdsong on top.
 *
 * The birdsong is scheduled rather than looped, because a loop of the same
 * two notes is not birdsong — it is a ringtone. Each chirp is a short
 * falling chirp, placed at an irregular interval.
 */
function buildForest(
  context: AudioContext,
  destination: AudioNode,
): { nodes: AudioScheduledSourceNode[]; timer: number; release: () => void } {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 500;

  const bed = context.createGain();
  bed.gain.value = 0.28;

  lowpass.connect(bed);
  bed.connect(destination);

  const nodes: AudioScheduledSourceNode[] = [startNoise(context, lowpass, true)];

  const chirp = (): void => {
    try {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = 'sine';

      const startAt = context.currentTime;
      const from = 1_800 + Math.random() * 900;
      const to = from * (0.55 + Math.random() * 0.2);

      oscillator.frequency.setValueAtTime(from, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(to, startAt + 0.18);

      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

      oscillator.connect(envelope);
      envelope.connect(destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + 0.3);
    } catch {
      // A chirp that cannot be played is not worth failing the ambience for.
    }
  };

  const timer = window.setInterval(chirp, 2_600 + Math.random() * 3_400);

  // The chirps are scheduled on the audio clock and stop themselves, so
  // there is nothing to release beyond the interval the caller already
  // clears.
  return { nodes, timer, release: () => undefined };
}

/**
 * Starts the fireplace: a low bed of noise, with cracks on top of it.
 *
 * A fire is not a texture, it is a *texture with events in it*. The bed
 * alone would be indistinguishable from the rain, so the cracks are what
 * make it a fire — and they have to be irregular, because a loop of the
 * same crack is a click track rather than a hearth.
 *
 * Each crack is a short burst of noise with a fast decay, placed at an
 * irregular interval. A few of them are placed close together, because
 * that is what a log settling sounds like.
 */
function buildFire(
  context: AudioContext,
  destination: AudioNode,
): { nodes: AudioScheduledSourceNode[]; timer: number; release: () => void } {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 700;

  const bed = context.createGain();
  bed.gain.value = 0.22;

  lowpass.connect(bed);
  bed.connect(destination);

  const nodes: AudioScheduledSourceNode[] = [startNoise(context, lowpass, true)];

  const crack = (): void => {
    try {
      const source = context.createBufferSource();
      source.buffer = fillNoise(context, false);

      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      // The pitch of a crack is high and narrow, and it is what makes it a
      // crack rather than a thud.
      filter.frequency.value = 1_400 + Math.random() * 2_600;
      filter.Q.value = 3;

      const envelope = context.createGain();
      const startAt = context.currentTime;
      const peak = 0.05 + Math.random() * 0.12;

      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(peak, startAt + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.09);

      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(destination);

      source.start(startAt);
      source.stop(startAt + 0.12);
    } catch {
      // A crack that cannot be played is not worth failing the ambience for.
    }
  };

  // The second crack of a settling log is a timeout rather than a scheduled
  // node, so it has to be tracked: a fire that has been stopped must not
  // crack once more on its way out.
  const pending = new Set<number>();

  const timer = window.setInterval(() => {
    crack();

    // A log settling: a second crack a moment later.
    if (Math.random() < 0.35) {
      const id = window.setTimeout(() => {
        pending.delete(id);
        crack();
      }, 90 + Math.random() * 160);

      pending.add(id);
    }
  }, 700 + Math.random() * 1_800);

  return {
    nodes,
    timer,
    release: () => {
      for (const id of pending) {
        window.clearTimeout(id);
      }

      pending.clear();
    },
  };
}

/**
 * Plays the ambience.
 *
 * Calling it again with a different ambience replaces the current one, and
 * calling it with the same one only changes the volume. It never throws:
 * the ambience is a nicety, and a failure to play it must not interrupt the
 * timer.
 */
export function startAmbience(id: AmbienceId, volume: number): void {
  try {
    if (id === 'none') {
      stopAmbience();
      return;
    }

    const context = getAudioContext();
    if (!context) {
      return;
    }

    // Every request takes a number, and a start that finishes after a newer
    // request has been made is dropped. Without it, a suspended context that
    // resumes twice would start the ambience that was asked for *first*.
    generation += 1;
    const requested = generation;

    // A suspended context cannot make a sound. It is resumed first, and the
    // ambience is started when the resume has actually happened — otherwise
    // the sources would be scheduled against a frozen clock.
    const start = (): void => {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);

      let nodes: AudioScheduledSourceNode[];
      let timer: number | null = null;
      let release = (): void => undefined;

      if (id === 'brown') {
        nodes = buildBrown(context, gain);
      } else if (id === 'white') {
        nodes = buildWhite(context, gain);
      } else if (id === 'rain') {
        nodes = buildRain(context, gain);
      } else if (id === 'waves') {
        nodes = buildWaves(context, gain);
      } else if (id === 'fire') {
        const fire = buildFire(context, gain);
        nodes = fire.nodes;
        timer = fire.timer;
        release = fire.release;
      } else {
        const forest = buildForest(context, gain);
        nodes = forest.nodes;
        timer = forest.timer;
        release = forest.release;
      }

      // The gain is faded in rather than set, because a background sound
      // that starts at full volume is a jolt.
      const level = Math.min(1, Math.max(0, volume)) * MASTER_GAIN;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(level, context.currentTime + 1.2);

      stopAmbience();
      session = { nodes, gain, timer, release };
    };

    if (context.state === 'suspended') {
      void context
        .resume()
        .then(() => {
          if (requested === generation) {
            start();
          }
        })
        .catch(() => {
          // The context could not be resumed, so there is no clock to play
          // against. The session simply does not start.
        });
      return;
    }

    start();
  } catch {
    // Ignore: the ambience is best-effort.
  }
}

/**
 * Stops the ambience and releases its nodes.
 *
 * The gain is faded out first, so stopping the sound does not click.
 */
export function stopAmbience(): void {
  const current = session;
  session = null;

  // A stop invalidates any start that is still waiting on a resume: the
  // sound the user has just turned off must not begin a moment later.
  generation += 1;

  if (!current) {
    return;
  }

  try {
    if (current.timer !== null) {
      window.clearInterval(current.timer);
    }

    current.release();

    const context = getAudioContext();
    const now = context?.currentTime ?? 0;

    current.gain.gain.cancelScheduledValues(now);
    current.gain.gain.setValueAtTime(current.gain.gain.value, now);
    current.gain.gain.linearRampToValueAtTime(0, now + 0.4);

    for (const node of current.nodes) {
      try {
        node.stop(now + 0.5);
      } catch {
        // A node that has already stopped is not an error.
      }
    }
  } catch {
    // Ignore: stopping is best-effort.
  }
}

/**
 * Changes the volume of the running ambience.
 *
 * The change is applied to the gain, so it takes effect immediately without
 * restarting the sound — restarting would be audible, and a volume change
 * is not a change of ambience.
 */
export function setAmbienceVolume(volume: number): void {
  try {
    const current = session;
    const context = getAudioContext();

    if (!current || !context) {
      return;
    }

    const level = Math.min(1, Math.max(0, volume)) * MASTER_GAIN;
    const now = context.currentTime;

    current.gain.gain.cancelScheduledValues(now);
    current.gain.gain.setValueAtTime(current.gain.gain.value, now);
    current.gain.gain.linearRampToValueAtTime(level, now + 0.3);
  } catch {
    // Ignore: the volume is best-effort.
  }
}
