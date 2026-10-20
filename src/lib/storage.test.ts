import { beforeEach, describe, expect, it } from 'vitest';

import { defaultConfig } from '@/domain/presets';
import { createInitialState, start } from '@/domain/timer';
import type { TimerState } from '@/domain/types';
import {
  clearPersistedTimer,
  isTimerConfig,
  isTimerState,
  readPersistedTimer,
  repairTimerState,
  TIMER_STORAGE_KEY,
  writePersistedTimer,
} from '@/lib/storage';

const T0 = 1_700_000_000_000;

/**
 * A timer state with one field removed.
 *
 * The cast goes through `unknown` because `TimerState` has no index
 * signature; the point of the helper is to model a payload written by an
 * older build, which is not a `TimerState` at all.
 */
function withoutField(
  state: TimerState,
  field: 'completedFocusMs',
): Record<string, unknown> {
  const copy = { ...state } as unknown as Record<string, unknown>;
  delete copy[field];
  return copy;
}

describe('isTimerState', () => {
  it('accepts a well-formed state', () => {
    expect(isTimerState(createInitialState(defaultConfig()))).toBe(true);
  });

  it('rejects a state with an unknown phase', () => {
    expect(isTimerState({ ...createInitialState(defaultConfig()), phase: 'nap' })).toBe(false);
  });

  it('rejects a state with an unknown status', () => {
    expect(isTimerState({ ...createInitialState(defaultConfig()), status: 'busy' })).toBe(false);
  });

  it('rejects non-numeric counters', () => {
    expect(
      isTimerState({ ...createInitialState(defaultConfig()), completedWorkSessions: 'two' }),
    ).toBe(false);
  });

  it('rejects a state with no measured focus time', () => {
    const state = withoutField(createInitialState(defaultConfig()), 'completedFocusMs');

    expect(isTimerState(state)).toBe(false);
  });

  it('rejects values that are not objects', () => {
    expect(isTimerState(null)).toBe(false);
    expect(isTimerState('idle')).toBe(false);
    expect(isTimerState(undefined)).toBe(false);
  });
});

describe('repairTimerState', () => {
  it('back-fills the focus time for a snapshot from an older build', () => {
    const config = defaultConfig();
    const state = withoutField(createInitialState(config), 'completedFocusMs');
    state.totalWorkSessions = 2;

    const repaired = repairTimerState(state, config);

    expect(repaired).not.toBeNull();
    // The estimate the field replaced, so the number does not jump.
    expect(repaired?.completedFocusMs).toBe(2 * config.workMs);
  });

  it('leaves a state that is already complete alone', () => {
    const config = defaultConfig();
    const state = createInitialState(config);

    const repaired = repairTimerState(state, config);

    expect(repaired?.completedFocusMs).toBe(state.completedFocusMs);
  });

  it('rejects a state that is otherwise malformed', () => {
    const config = defaultConfig();
    const state = { ...createInitialState(config), phase: 'nap' };

    expect(repairTimerState(state, config)).toBeNull();
  });
});

describe('isTimerConfig', () => {
  it('accepts a well-formed config', () => {
    expect(isTimerConfig(defaultConfig())).toBe(true);
  });

  it('rejects a config missing a boolean flag', () => {
    const config = defaultConfig() as unknown as Record<string, unknown>;
    delete config.autoStartBreaks;

    expect(isTimerConfig(config)).toBe(false);
  });
});

describe('persistence round trip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes and reads back the timer state', () => {
    const config = defaultConfig();
    const state = start(createInitialState(config), T0);

    writePersistedTimer(state, config);
    const restored = readPersistedTimer();

    expect(restored).not.toBeNull();
    expect(restored?.state).toEqual(state);
    expect(restored?.config).toEqual(config);
  });

  it('returns null when nothing has been stored', () => {
    expect(readPersistedTimer()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    window.localStorage.setItem(TIMER_STORAGE_KEY, '{not json');

    expect(readPersistedTimer()).toBeNull();
  });

  it('returns null when the stored shape is invalid', () => {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ state: {}, config: {} }));

    expect(readPersistedTimer()).toBeNull();
  });

  it('restores a snapshot written before the focus time was tracked', () => {
    const config = defaultConfig();
    const state = withoutField(createInitialState(config), 'completedFocusMs');
    state.totalWorkSessions = 2;

    window.localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({ state, config, savedAt: T0 }),
    );

    const restored = readPersistedTimer();

    // The old snapshot is repaired, not discarded.
    expect(restored).not.toBeNull();
    expect(restored?.state.completedFocusMs).toBe(2 * config.workMs);
  });

  it('clears the stored snapshot', () => {
    writePersistedTimer(createInitialState(defaultConfig()), defaultConfig());
    clearPersistedTimer();

    expect(readPersistedTimer()).toBeNull();
  });
});
