import { beforeEach, describe, expect, it } from 'vitest';

import { defaultConfig } from '@/domain/presets';
import { createInitialState, start } from '@/domain/timer';
import {
  clearPersistedTimer,
  isTimerConfig,
  isTimerState,
  readPersistedTimer,
  TIMER_STORAGE_KEY,
  writePersistedTimer,
} from '@/lib/storage';

const T0 = 1_700_000_000_000;

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

  it('rejects values that are not objects', () => {
    expect(isTimerState(null)).toBe(false);
    expect(isTimerState('idle')).toBe(false);
    expect(isTimerState(undefined)).toBe(false);
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

  it('clears the stored snapshot', () => {
    writePersistedTimer(createInitialState(defaultConfig()), defaultConfig());
    clearPersistedTimer();

    expect(readPersistedTimer()).toBeNull();
  });
});
