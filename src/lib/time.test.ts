import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatDurationLong,
  isSameLocalDay,
  localDayKey,
  minutesToMs,
  msToMinutes,
  startOfLocalDay,
} from '@/lib/time';

describe('formatDuration', () => {
  it('formats minutes and seconds with zero padding', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(5_000)).toBe('00:05');
    expect(formatDuration(65_000)).toBe('01:05');
    expect(formatDuration(25 * 60_000)).toBe('25:00');
  });

  it('adds an hours segment for long durations', () => {
    expect(formatDuration(60 * 60_000)).toBe('1:00:00');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });

  it('clamps negative values to zero', () => {
    expect(formatDuration(-5_000)).toBe('00:00');
  });

  it('truncates rather than rounds so the countdown hits zero on time', () => {
    expect(formatDuration(1_999)).toBe('00:01');
  });
});

describe('formatDurationLong', () => {
  it('describes a duration in words', () => {
    expect(formatDurationLong(0)).toBe('0 s');
    expect(formatDurationLong(90_000)).toBe('1 min 30 s');
    expect(formatDurationLong(60 * 60_000)).toBe('1 h');
  });
});

describe('minutesToMs', () => {
  it('converts minutes to milliseconds', () => {
    expect(minutesToMs(25)).toBe(1_500_000);
    expect(minutesToMs(0)).toBe(0);
  });
});

describe('msToMinutes', () => {
  it('converts milliseconds to whole minutes', () => {
    expect(msToMinutes(1_500_000)).toBe(25);
    expect(msToMinutes(90_000)).toBe(2);
  });
});

describe('localDayKey', () => {
  it('formats a timestamp as a local calendar day', () => {
    const timestamp = new Date(2024, 4, 17, 13, 45).getTime();

    expect(localDayKey(timestamp)).toBe('2024-05-17');
  });

  it('treats timestamps on the same day as equal', () => {
    const morning = new Date(2024, 4, 17, 1, 0).getTime();
    const evening = new Date(2024, 4, 17, 23, 59).getTime();

    expect(isSameLocalDay(morning, evening)).toBe(true);
    expect(isSameLocalDay(morning, morning + 24 * 60 * 60_000)).toBe(false);
  });

  it('finds midnight at the start of the day', () => {
    const timestamp = new Date(2024, 4, 17, 13, 45).getTime();
    const midnight = startOfLocalDay(timestamp);

    const date = new Date(midnight);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getDate()).toBe(17);
  });
});
