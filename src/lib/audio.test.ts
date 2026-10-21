import { describe, expect, it } from 'vitest';

import { CUES, chimeForPhase } from './audio';
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
