import { describe, expect, it } from 'vitest';

import {
  clampDailyGoal,
  DEFAULT_PREFERENCES,
  MAX_DAILY_GOAL,
  MIN_DAILY_GOAL,
  normalizePreferences,
} from '@/domain/preferences';

describe('clampDailyGoal', () => {
  it('keeps the goal inside the supported range', () => {
    expect(clampDailyGoal(0)).toBe(MIN_DAILY_GOAL);
    expect(clampDailyGoal(-3)).toBe(MIN_DAILY_GOAL);
    expect(clampDailyGoal(1000)).toBe(MAX_DAILY_GOAL);
  });

  it('rounds a fractional goal', () => {
    expect(clampDailyGoal(6.4)).toBe(6);
    expect(clampDailyGoal(6.6)).toBe(7);
  });

  it('falls back to the default for a non-finite value', () => {
    expect(clampDailyGoal(Number.NaN)).toBe(DEFAULT_PREFERENCES.dailyGoal);
  });
});

describe('normalizePreferences', () => {
  it('returns the defaults for a value that is not an object', () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences('nope')).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps a fully valid set of preferences', () => {
    const preferences = {
      dailyGoal: 10,
      autoAdvanceTask: false,
      soundEnabled: false,
      confirmBeforeClearing: false,
      showCompletedTasks: false,
    };

    expect(normalizePreferences(preferences)).toEqual(preferences);
  });

  it('repairs a single corrupt field without discarding the rest', () => {
    const preferences = normalizePreferences({
      dailyGoal: 5,
      autoAdvanceTask: 'yes',
      soundEnabled: false,
      confirmBeforeClearing: true,
      showCompletedTasks: false,
    });

    expect(preferences.dailyGoal).toBe(5);
    expect(preferences.soundEnabled).toBe(false);
    expect(preferences.showCompletedTasks).toBe(false);
    // The corrupt field falls back to its default.
    expect(preferences.autoAdvanceTask).toBe(DEFAULT_PREFERENCES.autoAdvanceTask);
  });

  it('clamps an out-of-range goal', () => {
    expect(normalizePreferences({ dailyGoal: 0 }).dailyGoal).toBe(MIN_DAILY_GOAL);
    expect(normalizePreferences({ dailyGoal: 500 }).dailyGoal).toBe(MAX_DAILY_GOAL);
  });
});
