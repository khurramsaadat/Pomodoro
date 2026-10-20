import type { TimerPhase } from '@/domain/types';

/**
 * A small Web Audio synthesiser for the timer cues.
 *
 * The chimes are generated at runtime rather than shipped as audio files:
 * it keeps the bundle tiny, lets the volume be controlled precisely, and
 * makes it possible to give each phase a distinct timbre.
 */

export type ChimeSound = 'workComplete' | 'breakComplete';

const WORK_FREQUENCIES = [880, 1108.73] as const;
const BREAK_FREQUENCIES = [659.25, 523.25] as const;

export interface ChimeOptions {
  /** Output volume between 0 and 1. */
  readonly volume: number;
  /** Which cue to play. */
  readonly sound: ChimeSound;
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
 * Plays a short two-note chime.
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

    if (context.state === 'suspended') {
      void context.resume();
    }

    const frequencies =
      options.sound === 'workComplete' ? WORK_FREQUENCIES : BREAK_FREQUENCIES;
    const volume = Math.min(1, Math.max(0, options.volume));
    const now = context.currentTime;

    frequencies.forEach((frequency, index) => {
      const startAt = now + index * 0.18;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);

      // A short attack and an exponential decay avoid the click of a
      // hard-cut waveform.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.4), startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.6);
    });
  } catch {
    // Ignore: the AudioContext may be unavailable in some environments.
  }
}

/** The cue to play when a phase finishes. */
export function chimeForPhase(completedPhase: TimerPhase): ChimeSound {
  return completedPhase === 'work' ? 'workComplete' : 'breakComplete';
}

/**
 * Unlocks the AudioContext.
 *
 * Browsers only allow audio after a user gesture, so this is called from the
 * first user interaction with the app.
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
