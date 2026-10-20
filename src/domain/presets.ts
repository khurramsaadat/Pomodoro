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

/** The longest a focus session may be, in minutes. */
export const MAX_WORK_MINUTES = 120;

/** The longest a short break may be, in minutes. */
export const MAX_SHORT_BREAK_MINUTES = 60;

/** The longest a long break may be, in minutes. */
export const MAX_LONG_BREAK_MINUTES = 90;

/** The most focus sessions that may make up a set. */
export const MAX_LONG_BREAK_INTERVAL = 12;

/**
 * Whether a configuration is usable.
 *
 * A duration of zero or less would produce a timer that is over before it
 * starts, and a non-positive interval would make the long break due
 * immediately or never. Such a configuration is rejected rather than
 * repaired, because silently changing the user's settings would be worse
 * than refusing to load them.
 */
export function isValidConfig(config: TimerConfig): boolean {
  return (
    Number.isFinite(config.workMs) &&
    config.workMs > 0 &&
    Number.isFinite(config.shortBreakMs) &&
    config.shortBreakMs > 0 &&
    Number.isFinite(config.longBreakMs) &&
    config.longBreakMs > 0 &&
    Number.isInteger(config.longBreakInterval) &&
    config.longBreakInterval > 0 &&
    config.longBreakInterval <= MAX_LONG_BREAK_INTERVAL &&
    typeof config.autoStartBreaks === 'boolean' &&
    typeof config.autoStartWork === 'boolean'
  );
}

/**
 * Repairs a configuration, falling back to the defaults for invalid fields.
 *
 * This is used when a configuration is *authored* — by the settings UI or by
 * a preset — where a sensible repair is better than rejecting the input.
 */
export function normalizeConfig(value: unknown): TimerConfig {
  const fallback = defaultConfig();

  if (typeof value !== 'object' || value === null) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  const duration = (raw: unknown, fallbackMs: number): number =>
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : fallbackMs;

  return {
    workMs: duration(record.workMs, fallback.workMs),
    shortBreakMs: duration(record.shortBreakMs, fallback.shortBreakMs),
    longBreakMs: duration(record.longBreakMs, fallback.longBreakMs),
    longBreakInterval:
      typeof record.longBreakInterval === 'number' &&
      Number.isInteger(record.longBreakInterval) &&
      record.longBreakInterval > 0 &&
      record.longBreakInterval <= MAX_LONG_BREAK_INTERVAL
        ? record.longBreakInterval
        : fallback.longBreakInterval,
    autoStartBreaks:
      typeof record.autoStartBreaks === 'boolean' ? record.autoStartBreaks : fallback.autoStartBreaks,
    autoStartWork:
      typeof record.autoStartWork === 'boolean' ? record.autoStartWork : fallback.autoStartWork,
  };
}

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
