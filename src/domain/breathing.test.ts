import { describe, expect, it } from 'vitest';

import {
  BREATH_CYCLE_MS,
  EXHALE_MS,
  INHALE_MS,
  breathLabel,
  breathPhase,
  breathProgress,
  breathSwell,
} from './breathing';

describe('breathPhase', () => {
  it('is an inhale for the first half of the cycle', () => {
    expect(breathPhase(0)).toBe('inhale');
    expect(breathPhase(INHALE_MS - 1)).toBe('inhale');
  });

  it('is an exhale for the second half', () => {
    expect(breathPhase(INHALE_MS)).toBe('exhale');
    expect(breathPhase(BREATH_CYCLE_MS - 1)).toBe('exhale');
  });

  it('wraps at the end of the cycle', () => {
    expect(breathPhase(BREATH_CYCLE_MS)).toBe('inhale');
    expect(breathPhase(BREATH_CYCLE_MS * 3 + 10)).toBe('inhale');
  });

  it('handles a negative elapsed time without falling out of the cycle', () => {
    // A clock that is a little behind must not produce a phase nobody can
    // name; the modulo is wrapped rather than left negative.
    expect(breathPhase(-1)).toBe('exhale');
    expect(breathPhase(-BREATH_CYCLE_MS)).toBe('inhale');
  });
});

describe('breathProgress', () => {
  it('runs from 0 to 1 through the inhale and again through the exhale', () => {
    expect(breathProgress(0)).toBe(0);
    expect(breathProgress(INHALE_MS / 2)).toBe(0.5);
    expect(breathProgress(INHALE_MS)).toBe(0);
    expect(breathProgress(INHALE_MS + EXHALE_MS / 2)).toBe(0.5);
  });

  it('wraps at the end of the cycle', () => {
    expect(breathProgress(BREATH_CYCLE_MS)).toBe(0);
  });
});

describe('breathSwell', () => {
  it('is fully exhaled at the start and at the end of the cycle', () => {
    expect(breathSwell(0)).toBe(0);
    expect(breathSwell(BREATH_CYCLE_MS)).toBe(0);
  });

  it('is fully inhaled at the top of the breath', () => {
    expect(breathSwell(INHALE_MS)).toBe(1);
  });

  it('rises through the inhale and falls through the exhale', () => {
    // This is the one property the ring depends on: one number that goes up
    // and comes back down, rather than a progress value that resets halfway.
    expect(breathSwell(INHALE_MS / 2)).toBeGreaterThan(breathSwell(0));
    expect(breathSwell(INHALE_MS / 2)).toBeLessThan(breathSwell(INHALE_MS));
    expect(breathSwell(INHALE_MS + EXHALE_MS / 2)).toBeLessThan(breathSwell(INHALE_MS));
  });

  it('stays within the range the ring can draw', () => {
    for (let elapsed = 0; elapsed < BREATH_CYCLE_MS * 2; elapsed += 100) {
      const swell = breathSwell(elapsed);
      expect(swell).toBeGreaterThanOrEqual(0);
      expect(swell).toBeLessThanOrEqual(1);
    }
  });
});

describe('breathLabel', () => {
  it('names the half of the breath in words', () => {
    expect(breathLabel('inhale')).toBe('Breathe in');
    expect(breathLabel('exhale')).toBe('Breathe out');
  });
});
