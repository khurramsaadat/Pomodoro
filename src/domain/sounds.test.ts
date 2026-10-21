import { describe, expect, it } from 'vitest';

import { DEFAULT_SOUND, isSoundId, normalizeSoundId, SOUND_IDS, SOUND_OPTIONS } from './sounds';

describe('the sound catalogue', () => {
  it('gives every sound a name and a description', () => {
    for (const option of SOUND_OPTIONS) {
      expect(option.label).not.toBe('');
      expect(option.description).not.toBe('');
    }
  });

  it('lists every sound exactly once', () => {
    expect(new Set(SOUND_IDS).size).toBe(SOUND_IDS.length);
  });

  it('includes the default', () => {
    expect(SOUND_IDS).toContain(DEFAULT_SOUND);
  });
});

describe('isSoundId', () => {
  it('accepts a sound that exists', () => {
    expect(isSoundId('chime')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSoundId('kazoo')).toBe(false);
    expect(isSoundId(42)).toBe(false);
    expect(isSoundId(null)).toBe(false);
  });
});

describe('normalizeSoundId', () => {
  it('keeps a sound that exists', () => {
    expect(normalizeSoundId('bell')).toBe('bell');
  });

  it('falls back to the default for one that does not', () => {
    // A sound that no longer exists must not leave the user with no cue.
    expect(normalizeSoundId('kazoo')).toBe(DEFAULT_SOUND);
    expect(normalizeSoundId(undefined)).toBe(DEFAULT_SOUND);
  });
});
