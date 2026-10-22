import { describe, expect, it } from 'vitest';

import {
  AMBIENCE_IDS,
  AMBIENCE_OPTIONS,
  DEFAULT_AMBIENCE,
  DEFAULT_AMBIENCE_VOLUME,
  MAX_AMBIENCE_VOLUME,
  MIN_AMBIENCE_VOLUME,
  clampAmbienceVolume,
  isAmbienceId,
  normalizeAmbienceId,
} from './ambience';

describe('the ambience catalogue', () => {
  it('gives every ambience a name and a description', () => {
    for (const option of AMBIENCE_OPTIONS) {
      expect(option.label).not.toBe('');
      expect(option.description).not.toBe('');
    }
  });

  it('lists every ambience exactly once', () => {
    expect(new Set(AMBIENCE_IDS).size).toBe(AMBIENCE_IDS.length);
  });

  it('offers silence, so a user can turn the ambience off', () => {
    expect(AMBIENCE_IDS).toContain('none');
    expect(AMBIENCE_IDS).toContain(DEFAULT_AMBIENCE);
  });

  it('offers the sounds the user asked for', () => {
    // The catalogue is a promise about what can be heard, so the sounds the
    // feature was asked for are pinned rather than left to the implementation.
    for (const id of ['brown', 'white', 'rain', 'waves', 'fire'] as const) {
      expect(AMBIENCE_IDS).toContain(id);
    }
  });
});

describe('isAmbienceId', () => {
  it('accepts an ambience that exists', () => {
    expect(isAmbienceId('brown')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAmbienceId('kazoo')).toBe(false);
    expect(isAmbienceId(42)).toBe(false);
    expect(isAmbienceId(null)).toBe(false);
  });
});

describe('normalizeAmbienceId', () => {
  it('keeps an ambience that exists', () => {
    expect(normalizeAmbienceId('rain')).toBe('rain');
  });

  it('falls back to silence for one that does not', () => {
    // A sound that no longer exists must become silence rather than leaving
    // the app playing something the user never chose.
    expect(normalizeAmbienceId('kazoo')).toBe(DEFAULT_AMBIENCE);
    expect(normalizeAmbienceId(undefined)).toBe(DEFAULT_AMBIENCE);
  });
});

describe('clampAmbienceVolume', () => {
  it('keeps a volume inside the range', () => {
    expect(clampAmbienceVolume(0.4)).toBe(0.4);
  });

  it('clamps a volume outside the range', () => {
    expect(clampAmbienceVolume(-2)).toBe(MIN_AMBIENCE_VOLUME);
    expect(clampAmbienceVolume(42)).toBe(MAX_AMBIENCE_VOLUME);
  });

  it('repairs a number that is not a number', () => {
    // A corrupt payload is restored as the default rather than as silence,
    // so an upgraded user does not lose the volume they had set.
    expect(clampAmbienceVolume(Number.NaN)).toBe(DEFAULT_AMBIENCE_VOLUME);
    expect(clampAmbienceVolume(Number.POSITIVE_INFINITY)).toBe(DEFAULT_AMBIENCE_VOLUME);
  });
});
