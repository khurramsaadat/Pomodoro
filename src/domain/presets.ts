import type { TimerConfig } from './types';

export interface TimerPreset {
  readonly id: string;
  readonly label: string;
  /** A short human summary such as "25 / 5 / 15". */
  readonly summary: string;
  readonly workMinutes: number;
  readonly shortBreakMinutes: number;
  readonly longBreakMinutes: number;
}

/**
 * Ready-made session shapes.
 *
 * `classic` is the default because 25/5 has the best adherence rate. `deep`
 * suits long uninterrupted work, and `sprint` suits short bursts. Every
 * duration remains user-configurable.
 */
export const TIMER_PRESETS: readonly TimerPreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    summary: '25 / 5 / 15',
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  },
  {
    id: 'deep',
    label: 'Deep work',
    summary: '50 / 10 / 25',
    workMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 25,
  },
  {
    id: 'sprint',
    label: 'Sprint',
    summary: '15 / 5 / 10',
    workMinutes: 15,
    shortBreakMinutes: 5,
    longBreakMinutes: 10,
  },
];

export const DEFAULT_PRESET_ID = 'classic';

const MINUTE_MS = 60_000;

/** The number of focus sessions that make up a full set. */
export const DEFAULT_LONG_BREAK_INTERVAL = 4;

/** Builds a timer configuration from a preset. */
export function configFromPreset(
  preset: TimerPreset,
  overrides: Partial<Omit<TimerConfig, 'workMs' | 'shortBreakMs' | 'longBreakMs'>> = {},
): TimerConfig {
  return {
    workMs: preset.workMinutes * MINUTE_MS,
    shortBreakMs: preset.shortBreakMinutes * MINUTE_MS,
    longBreakMs: preset.longBreakMinutes * MINUTE_MS,
    longBreakInterval: DEFAULT_LONG_BREAK_INTERVAL,
    autoStartBreaks: true,
    autoStartWork: false,
    ...overrides,
  };
}

/** The preset used when nothing has been chosen or stored. */
export function defaultPreset(): TimerPreset {
  const fallback = TIMER_PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID);
  if (!fallback) {
    throw new Error('The default timer preset is missing from TIMER_PRESETS');
  }
  return fallback;
}

/** The configuration used before the user changes anything. */
export function defaultConfig(): TimerConfig {
  return configFromPreset(defaultPreset());
}
