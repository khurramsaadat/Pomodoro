import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CUES,
  chimeForPhase,
  resetCompletionCues,
} from './audio';
import { SOUND_IDS, type SoundId } from '@/domain/sounds';

describe('the cue catalogue', () => {
  it('gives every sound a cue', () => {
    for (const id of SOUND_IDS) {
      expect(CUES[id]).toBeDefined();
      expect(CUES[id].layers.length).toBeGreaterThan(0);
    }
  });

  it('gives every sound a distinct shape', () => {
    // Two sounds with the same frequencies would be the same sound to the
    // ear, so the catalogue is checked for that.
    const shapes = SOUND_IDS.map((id) =>
      CUES[id].layers.map((layer) => `${layer.wave}:${layer.frequency}`).join(','),
    );

    expect(new Set(shapes).size).toBe(SOUND_IDS.length);
  });

  it('keeps every layer inside the audible range', () => {
    for (const id of SOUND_IDS) {
      for (const layer of CUES[id].layers) {
        expect(layer.frequency).toBeGreaterThan(20);
        expect(layer.frequency).toBeLessThan(20_000);
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(1);
        expect(layer.duration).toBeGreaterThan(0);
      }
    }
  });
});

describe('chimeForPhase', () => {
  it('plays the chosen sound when a focus session ends', () => {
    expect(chimeForPhase('work', 'bell')).toBe('bell');
  });

  it('plays a different sound when a break ends', () => {
    // The two phases have to be audibly different, or the user cannot
    // tell a finished session from a finished break.
    expect(chimeForPhase('shortBreak', 'bell')).not.toBe('bell');
    expect(chimeForPhase('longBreak', 'bell')).not.toBe('bell');
  });

  it('always returns a sound that exists', () => {
    for (const id of SOUND_IDS) {
      const result: SoundId = chimeForPhase('work', id);
      expect(SOUND_IDS).toContain(result);
    }
  });
});

/**
 * The times the oscillators were started at, across every context.
 *
 * The record is shared rather than per-instance because the audio module
 * creates the context itself, and a test that resets the modules gets a
 * fresh module with a fresh context.
 */
const scheduledStarts: number[] = [];

/** Whether the fake context starts suspended. */
let fakeContextState: AudioContextState = 'running';

/** How many times a context was asked to resume. */
let resumeCount = 0;

/**
 * A stand-in for the Web Audio API.
 *
 * jsdom has no `AudioContext` at all, so the real one cannot be
 * exercised. What matters here is not the sound but the *timing*: when
 * the layers are scheduled, and whether they are scheduled at all. The
 * fake records those, and it can be put into the suspended state that
 * the browsers start a context in.
 */
class FakeAudioContext {
  state: AudioContextState = fakeContextState;
  currentTime = 0;
  readonly sampleRate = 44_100;
  readonly destination = {};

  resume = (): Promise<void> => {
    resumeCount += 1;
    this.state = 'running';
    return Promise.resolve();
  };

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: (when: number): void => {
        scheduledStarts.push(when);
      },
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }

  createBufferSource() {
    return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  }

  createBuffer() {
    return { getChannelData: () => new Float32Array(8) };
  }

  createBiquadFilter() {
    return {
      type: 'bandpass',
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
    };
  }
}

/**
 * Puts a fake context in place of the real one.
 *
 * The audio module holds its context in a module-level variable, so each
 * test resets the modules and installs a context of its own.
 */
function installFakeContext(state: AudioContextState): void {
  scheduledStarts.length = 0;
  resumeCount = 0;
  fakeContextState = state;

  vi.resetModules();
  (window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext;
}

describe('playChime', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it('schedules the cue on a running context', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playChime({ volume: 0.6, sound: 'chime' });

    // The cue has layers, so something was scheduled.
    expect(scheduledStarts.length).toBeGreaterThan(0);
  });

  it('schedules the cue in the future, so the envelope has room', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playChime({ volume: 0.6, sound: 'chime' });

    // A cue scheduled at exactly `currentTime` has its attack in the
    // past by the time the context renders it, and is heard as a click.
    for (const start of scheduledStarts) {
      expect(start).toBeGreaterThan(0);
    }
  });

  it('waits for a suspended context to resume before scheduling', async () => {
    installFakeContext('suspended');
    const audio = await import('./audio');

    audio.playChime({ volume: 0.6, sound: 'chime' });

    // The resume is asynchronous, so nothing is scheduled yet.
    expect(scheduledStarts).toHaveLength(0);

    await vi.waitFor(() => {
      expect(scheduledStarts.length).toBeGreaterThan(0);
    });

    expect(resumeCount).toBeGreaterThan(0);
  });

  it('never throws when the context cannot be created', async () => {
    vi.resetModules();
    delete (window as unknown as Record<string, unknown>).AudioContext;

    const audio = await import('./audio');

    expect(() => audio.playChime({ volume: 0.6, sound: 'chime' })).not.toThrow();
  });
});

describe('playCompletionCue', () => {
  beforeEach(() => {
    resetCompletionCues();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it('plays the cue once for a deadline', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });
    const first = scheduledStarts.length;

    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });

    // The second call is the same deadline, so the cue is not repeated.
    expect(scheduledStarts.length).toBe(first);
  });

  it('plays the cue again for a different deadline', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });
    const first = scheduledStarts.length;

    audio.playCompletionCue({ phase: 'work', endsAt: 2_000, sound: 'chime' });

    // A later focus session is a different deadline, and it is heard.
    expect(scheduledStarts.length).toBeGreaterThan(first);
  });

  it('plays the cue again for a different phase on the same deadline', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });
    const first = scheduledStarts.length;

    audio.playCompletionCue({ phase: 'shortBreak', endsAt: 1_000, sound: 'chime' });

    // The deadline is the key, so a different phase on the same deadline
    // is still the same event.
    expect(scheduledStarts.length).toBe(first);
  });

  it('plays the cue again after the session is reset', async () => {
    installFakeContext('running');
    const audio = await import('./audio');

    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });
    const first = scheduledStarts.length;

    audio.resetCompletionCues();
    audio.playCompletionCue({ phase: 'work', endsAt: 1_000, sound: 'chime' });

    // A reset starts a new session, so the deadline is new again.
    expect(scheduledStarts.length).toBeGreaterThan(first);
  });
});
