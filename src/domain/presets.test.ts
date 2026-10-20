import { describe, expect, it } from 'vitest';

import {
  configFromPreset,
  defaultConfig,
  defaultPreset,
  isValidConfig,
  MAX_LONG_BREAK_INTERVAL,
  normalizeConfig,
  TIMER_PRESETS,
} from '@/domain/presets';

const MINUTE = 60_000;

describe('configFromPreset', () => {
  it('builds a config from a preset in milliseconds', () => {
    const config = configFromPreset(defaultPreset());

    expect(config.workMs).toBe(25 * MINUTE);
    expect(config.shortBreakMs).toBe(5 * MINUTE);
    expect(config.longBreakMs).toBe(15 * MINUTE);
  });

  it('exposes every preset with a summary', () => {
    for (const preset of TIMER_PRESETS) {
      expect(preset.summary).toMatch(/^\d+ \/ \d+ \/ \d+$/);
    }
  });
});

describe('isValidConfig', () => {
  it('accepts the default config', () => {
    expect(isValidConfig(defaultConfig())).toBe(true);
  });

  it('rejects a non-positive duration', () => {
    const config = defaultConfig();

    expect(isValidConfig({ ...config, workMs: 0 })).toBe(false);
    expect(isValidConfig({ ...config, workMs: -1000 })).toBe(false);
    expect(isValidConfig({ ...config, shortBreakMs: 0 })).toBe(false);
    expect(isValidConfig({ ...config, longBreakMs: 0 })).toBe(false);
  });

  it('rejects a non-finite duration', () => {
    const config = defaultConfig();

    expect(isValidConfig({ ...config, workMs: Number.NaN })).toBe(false);
    expect(isValidConfig({ ...config, workMs: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('rejects an invalid long break interval', () => {
    const config = defaultConfig();

    expect(isValidConfig({ ...config, longBreakInterval: 0 })).toBe(false);
    expect(isValidConfig({ ...config, longBreakInterval: -2 })).toBe(false);
    expect(isValidConfig({ ...config, longBreakInterval: 2.5 })).toBe(false);
    expect(isValidConfig({ ...config, longBreakInterval: MAX_LONG_BREAK_INTERVAL + 1 })).toBe(false);
  });
});

describe('normalizeConfig', () => {
  it('returns the defaults for a value that is not an object', () => {
    expect(normalizeConfig(null)).toEqual(defaultConfig());
    expect(normalizeConfig('nope')).toEqual(defaultConfig());
  });

  it('keeps a valid config unchanged', () => {
    const config = defaultConfig();

    expect(normalizeConfig(config)).toEqual(config);
  });

  it('repairs an invalid duration with the default', () => {
    const normalized = normalizeConfig({ ...defaultConfig(), workMs: 0 });

    expect(normalized.workMs).toBe(defaultConfig().workMs);
  });

  it('repairs an invalid interval with the default', () => {
    const normalized = normalizeConfig({ ...defaultConfig(), longBreakInterval: 0 });

    expect(normalized.longBreakInterval).toBe(defaultConfig().longBreakInterval);
  });

  it('repairs a non-boolean flag with the default', () => {
    const normalized = normalizeConfig({ ...defaultConfig(), autoStartWork: 'yes' });

    expect(normalized.autoStartWork).toBe(defaultConfig().autoStartWork);
  });

  it('always produces a valid config', () => {
    const normalized = normalizeConfig({ workMs: -5, longBreakInterval: 0 });

    expect(isValidConfig(normalized)).toBe(true);
  });
});