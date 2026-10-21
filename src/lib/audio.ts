import { SOUND_IDS, type SoundId } from '@/domain/sounds';
import type { TimerPhase } from '@/domain/types';

/**
 * A small Web Audio synthesiser for the timer cues.
 *
 * The chimes are generated at runtime rather than shipped as audio files:
 * it keeps the bundle tiny, lets the volume be controlled precisely, and
 * makes it possible to give each phase a distinct timbre.
 *
 * A cue is not one wave but a *stack* of layers — a body tone, a fifth
 * above it, and a soft noise transient — because a single sine is a beep
 * and a beep is easy to ignore. The layering is what makes the cue read as
 * an instrument rather than a diagnostic tone.
 */

/** The waveform an oscillator uses. */
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

/** One layer of a cue. */
export interface Layer {
  /** The oscillator's waveform. */
  readonly wave: Waveform;
  /** The frequency, in hertz. */
  readonly frequency: number;
  /** When the layer starts, in seconds after the cue begins. */
  readonly offset: number;
  /** How long the layer sounds for, in seconds. */
  readonly duration: number;
  /** The peak gain of the layer, from 0 to 1. */
  readonly gain: number;
}

/** The shape of a cue. */
export interface Cue {
  /** The layers, in the order they are stacked. */
  readonly layers: readonly Layer[];
  /** Whether a short burst of noise is mixed in. */
  readonly noise: boolean;
  /** The duration of the noise burst, in seconds. */
  readonly noiseDuration: number;
}

/**
 * The cues, one per sound.
 *
 * They are deliberately different in *shape* and not only in pitch: a
 * higher-pitched version of the same cue is harder to tell apart than a
 * completely different one, and the user is choosing a sound they will hear
 * without looking at the screen.
 */
export const CUES: Record<SoundId, Cue> = {
  // A soft rising two-note chime.
  chime: {
    layers: [
      { wave: 'sine', frequency: 880, offset: 0, duration: 0.6, gain: 0.4 },
      { wave: 'sine', frequency: 1108.73, offset: 0.18, duration: 0.7, gain: 0.34 },
      { wave: 'triangle', frequency: 1760, offset: 0, duration: 0.35, gain: 0.1 },
    ],
    noise: false,
    noiseDuration: 0,
  },

  // A struck bell: a low fundamental with inharmonic partials on top.
  bell: {
    layers: [
      { wave: 'sine', frequency: 523.25, offset: 0, duration: 1.8, gain: 0.42 },
      { wave: 'sine', frequency: 1046.5, offset: 0, duration: 1.1, gain: 0.2 },
      { wave: 'sine', frequency: 1401.2, offset: 0, duration: 0.7, gain: 0.12 },
      { wave: 'sine', frequency: 2093, offset: 0, duration: 0.4, gain: 0.07 },
    ],
    noise: true,
    noiseDuration: 0.06,
  },

  // A short wooden mallet: quick, woody, and gone before it can grate.
  marimba: {
    layers: [
      { wave: 'sine', frequency: 783.99, offset: 0, duration: 0.35, gain: 0.42 },
      { wave: 'sine', frequency: 1174.66, offset: 0, duration: 0.2, gain: 0.14 },
      { wave: 'sine', frequency: 1567.98, offset: 0.08, duration: 0.3, gain: 0.2 },
    ],
    noise: true,
    noiseDuration: 0.04,
  },

  // A muted electronic blip: a square wave with a quick fall.
  pulse: {
    layers: [
      { wave: 'square', frequency: 440, offset: 0, duration: 0.22, gain: 0.16 },
      { wave: 'square', frequency: 660, offset: 0.14, duration: 0.22, gain: 0.14 },
      { wave: 'sine', frequency: 220, offset: 0, duration: 0.5, gain: 0.12 },
    ],
    noise: false,
    noiseDuration: 0,
  },

  // A bright four-step arpeggio.
  digital: {
    layers: [
      { wave: 'triangle', frequency: 659.25, offset: 0, duration: 0.2, gain: 0.3 },
      { wave: 'triangle', frequency: 783.99, offset: 0.12, duration: 0.2, gain: 0.3 },
      { wave: 'triangle', frequency: 987.77, offset: 0.24, duration: 0.2, gain: 0.3 },
      { wave: 'triangle', frequency: 1318.51, offset: 0.36, duration: 0.45, gain: 0.34 },
      { wave: 'square', frequency: 2637.02, offset: 0.36, duration: 0.2, gain: 0.05 },
    ],
    noise: false,
    noiseDuration: 0,
  },
};

export interface ChimeOptions {
  /** Output volume between 0 and 1. */
  readonly volume: number;
  /** Which cue to play. */
  readonly sound: SoundId;
}

/** A completion cue, addressed by the deadline that reached it. */
export interface CompletionCueOptions {
  /** The phase that ended. */
  readonly phase: TimerPhase;
  /** The deadline that was reached, in epoch ms. */
  readonly endsAt: number;
  /** Which cue the user has chosen. */
  readonly sound: SoundId;
}

let sharedContext: AudioContext | null = null;

/**
 * Returns the shared AudioContext, creating it on first use.
 *
 * Browsers require a user gesture before audio can play, so the context may
 * start in a `suspended` state; `resume()` is called before each cue.
 */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) {
    return null;
  }

  sharedContext ??= new Ctor();
  return sharedContext;
}

/**
 * How far ahead of the context's clock a cue is scheduled.
 *
 * The margin exists because a context that is resuming does not advance its
 * clock in step with the wall clock. A cue scheduled at exactly
 * `currentTime` has its attack in the past by the time the context actually
 * starts rendering, so the envelope is already decaying — or over — when
 * the first sample is produced, and the cue is heard as a click.
 *
 * Scheduling slightly in the future gives the envelope somewhere to live.
 */
const SCHEDULE_MARGIN_S = 0.05;

/**
 * Plays one layer of a cue.
 *
 * The gain envelope is an attack and an exponential decay: a hard-cut
 * waveform clicks, and a click at the end of a cue is the difference
 * between a sound and a nuisance.
 */
function playLayer(context: AudioContext, layer: Layer, volume: number, startAt: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = layer.wave;
  oscillator.frequency.setValueAtTime(layer.frequency, startAt);

  const peak = Math.max(0.0001, volume * layer.gain);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + layer.duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + layer.duration + 0.05);
}

/**
 * Plays a short burst of noise.
 *
 * The noise is the *transient* — the click of a mallet on wood, the scrape
 * of a beater on a bell. It is what stops these cues sounding like
 * electronic beeps, and it is very quiet.
 */
function playNoise(context: AudioContext, volume: number, startAt: number, duration: number): void {
  const frames = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frames; index += 1) {
    // The fall makes the burst read as a strike rather than a hiss.
    const fall = 1 - index / frames;
    channel[index] = (Math.random() * 2 - 1) * fall;
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.9;

  gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.12), startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
}

/**
 * Plays a completion cue.
 *
 * Never throws: audio is a nicety, and a failure to play must not interrupt
 * the timer.
 */
export function playChime(options: ChimeOptions): void {
  try {
    const context = getContext();
    if (!context) {
      return;
    }

    // An unknown sound falls back to the default rather than being silent:
    // the cue is the one thing that says the phase ended.
    const id = (SOUND_IDS as readonly string[]).includes(options.sound)
      ? options.sound
      : 'chime';
    const cue = CUES[id];

    const volume = Math.min(1, Math.max(0, options.volume));

    // A suspended context has to be resumed *before* the cue is scheduled.
    //
    // The old code called `resume()` and carried on. `resume()` is
    // asynchronous, so the context was still suspended when the layers were
    // scheduled, and `currentTime` was frozen: the whole envelope was laid
    // out in a window that had already passed. The cue was then played —
    // or clipped to a click — when the context finally woke up, which is
    // why the sound was unreliable exactly when it was most needed: right
    // after the tab came back from the background.
    //
    // Resuming first and scheduling against the *new* clock is what makes
    // the cue sound the same whether the app was in the foreground or not.
    if (context.state === 'suspended') {
      void context
        .resume()
        .then(() => {
          scheduleCue(context, cue, volume);
        })
        .catch(() => {
          // The context could not be resumed, so there is no clock to
          // schedule against. The cue is lost, but the timer is not
          // interrupted.
        });
      return;
    }

    scheduleCue(context, cue, volume);
  } catch {
    // Ignore: the AudioContext may be unavailable in some environments.
  }
}

/**
 * Lays a cue out on the context's clock.
 *
 * The start time is a little in the future so that the attack and the decay
 * of the envelope both happen while the context is rendering, rather than
 * partly before it.
 */
function scheduleCue(context: AudioContext, cue: Cue, volume: number): void {
  const startAt = context.currentTime + SCHEDULE_MARGIN_S;

  for (const layer of cue.layers) {
    playLayer(context, layer, volume, startAt + layer.offset);
  }

  if (cue.noise) {
    playNoise(context, volume, startAt, cue.noiseDuration);
  }
}

/**
 * The cue to play when a phase finishes.
 *
 * A focus session and a break are told apart by their *shape* rather than
 * only by their pitch: the break that ends gets the next voice along, so the
 * two phases are audibly different without needing a second setting.
 */
export function chimeForPhase(completedPhase: TimerPhase, sound: SoundId): SoundId {
  if (completedPhase === 'work') {
    return sound;
  }

  const index = SOUND_IDS.indexOf(sound);
  return SOUND_IDS[(index + 1) % SOUND_IDS.length] ?? 'chime';
}

/**
 * Unlocks the AudioContext.
 *
 * Browsers only allow audio after a user gesture, so this is called from
 * the first user interaction with the app.
 */
export async function unlockAudio(): Promise<void> {
  try {
    const context = getContext();
    if (context && context.state === 'suspended') {
      await context.resume();
    }
  } catch {
    // Ignore: unlocking is best-effort.
  }
}

/** The volume the completion cue is played at. */
const CUE_VOLUME = 0.6;

/**
 * The deadlines whose cue has already been played.
 *
 * Two independent clocks watch the same deadline: the page's own tick, and
 * the desktop tier's host alarm. Both of them can notice that a deadline
 * has passed, and both of them may fire for it — the page's tick first if
 * the webview is awake, the host's alarm first if it was not.
 *
 * The deadline is the key because it is the one thing both clocks agree
 * on: it is the same `endsAt` the countdown is drawn from. The phase is
 * not, because the same phase recurs — the fourth focus session ends a
 * phase called `work`, and so does the fifth.
 */
const cuedDeadlines = new Set<number>();

/**
 * How many deadlines are remembered.
 *
 * The set is only there to de-duplicate the two clocks, so it only has to
 * outlive the gap between them. A bound keeps it from growing for the
 * lifetime of a long-running timer.
 */
const MAX_CUED_DEADLINES = 32;

/**
 * Plays the completion cue for a deadline that has been reached.
 *
 * The cue is played at most once per deadline, whichever clock notices it
 * first.
 */
export function playCompletionCue(options: CompletionCueOptions): void {
  const { phase, endsAt, sound } = options;

  if (cuedDeadlines.has(endsAt)) {
    return;
  }

  cuedDeadlines.add(endsAt);

  // The oldest entry is dropped once the set is full. The set is a
  // de-duplication device rather than a record, so the order does not
  // matter; the insertion order is simply the cheapest way to find one.
  if (cuedDeadlines.size > MAX_CUED_DEADLINES) {
    const oldest = cuedDeadlines.values().next();
    if (!oldest.done) {
      cuedDeadlines.delete(oldest.value);
    }
  }

  playChime({
    volume: CUE_VOLUME,
    sound: chimeForPhase(phase, sound),
  });
}

/**
 * Forgets the cues that have already been played.
 *
 * It is called when the session is reset: the deadlines after a reset are
 * different deadlines, but a timer that was reset and restarted inside the
 * same millisecond would otherwise be silenced.
 */
export function resetCompletionCues(): void {
  cuedDeadlines.clear();
}
