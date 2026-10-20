import { afterAll, describe, expect, it } from 'vitest';

import { currentStreak, focusMsByDay, type SessionEntry } from '@/domain/history';

/**
 * The streak must count *calendar* days, and the only way to prove that is
 * to run the test in a time zone that observes daylight saving.
 *
 * The zone is fixed for the whole file, at module scope, because `Date` reads
 * it when the process starts. The test would be meaningless in a zone with
 * no daylight saving — which is exactly what a naive test in UTC does.
 */
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'America/New_York';

afterAll(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

const MINUTE = 60_000;

/** Local noon on a given day, so the timestamp is nowhere near a boundary. */
function localNoon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function entry(endedAt: number, overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: `id-${endedAt}`,
    phase: 'work',
    startedAt: endedAt - 25 * MINUTE,
    endedAt,
    durationMs: 25 * MINUTE,
    taskId: null,
    taskTitle: null,
    interruptions: 0,
    voided: false,
    ...overrides,
  };
}

describe('the test environment', () => {
  it('runs in a zone that observes daylight saving', () => {
    const january = new Date(2026, 0, 15, 12).getTimezoneOffset();
    const july = new Date(2026, 6, 15, 12).getTimezoneOffset();

    // The offsets differ, so the zone changes its clocks over the year.
    expect(january).not.toBe(july);
  });
});

describe('currentStreak across a daylight-saving boundary', () => {
  it('counts the calendar days, not the elapsed milliseconds', () => {
    // The clocks go back at 2 a.m. on 1 November 2026, so that day is 25
    // hours long. The user worked on 30 October, skipped 31 October, and
    // worked again on 1 November — one day of work, one day missed.
    //
    // At 11 p.m. on 1 November a fixed 86 400 000 ms step lands on 1
    // November *again* rather than on 31 October, so the walk skips the
    // missed day and reports a two-day streak. The correct answer is one.
    const history = [
      entry(localNoon(2026, 11, 1)),
      entry(localNoon(2026, 10, 30)),
    ];

    const lateOnTheFirst = new Date(2026, 10, 1, 23, 0, 0, 0).getTime();

    expect(currentStreak(history, lateOnTheFirst)).toBe(1);
  });

  it('counts a run that spans the boundary unbroken', () => {
    // The user worked on 30 October, 31 October and 1 November. That is a
    // three-day streak, even though the first and last are 49 hours apart.
    const history = [
      entry(localNoon(2026, 11, 1)),
      entry(localNoon(2026, 10, 31)),
      entry(localNoon(2026, 10, 30)),
    ];

    expect(currentStreak(history, localNoon(2026, 11, 1))).toBe(3);
  });

  it('breaks the streak on a day that was genuinely missed', () => {
    // Worked on 1 November and 29 October, missing 30 and 31 October.
    const history = [entry(localNoon(2026, 11, 1)), entry(localNoon(2026, 10, 29))];

    const lateOnTheFirst = new Date(2026, 10, 1, 23, 0, 0, 0).getTime();

    expect(currentStreak(history, lateOnTheFirst)).toBe(1);
  });

  it('counts a day that the spring-forward transition shortens', () => {
    // The clocks go forward at 2 a.m. on 8 March 2026, so that day is only
    // 23 hours long. The user worked on 7 and 8 March, which is a two-day
    // streak — but a fixed 86 400 000 ms step skips a whole day here and
    // reports one.
    const history = [
      entry(localNoon(2026, 3, 8)),
      entry(localNoon(2026, 3, 7)),
    ];

    const justAfterMidnight = new Date(2026, 2, 9, 0, 0, 0, 0).getTime();

    expect(currentStreak(history, justAfterMidnight)).toBe(2);
  });

  it('tolerates an empty today', () => {
    // The user worked yesterday but not yet today. The streak is alive.
    const history = [entry(localNoon(2026, 10, 31))];

    expect(currentStreak(history, localNoon(2026, 11, 1))).toBe(1);
  });
});

describe('focusMsByDay across a daylight-saving boundary', () => {
  it('builds a window of consecutive calendar days', () => {
    // The chart window is built by stepping back a day at a time. A fixed
    // 86 400 000 ms step lands a day early once the clocks have gone back,
    // so the window covers the wrong seven days and a session that falls
    // outside it is dropped from the chart entirely.
    const history = [
      entry(localNoon(2026, 11, 1)),
      entry(localNoon(2026, 10, 31)),
      entry(localNoon(2026, 10, 30)),
    ];

    const lateOnTheFirst = new Date(2026, 10, 1, 23, 0, 0, 0).getTime();
    const chart = focusMsByDay(history, 7, lateOnTheFirst);

    const keys = chart.map((bucket) => bucket.dayKey);

    // Seven consecutive calendar days, ending on the day of the change.
    expect(keys).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);

    // Every session is in the window and on its own day.
    expect(chart[6]?.sessions).toBe(1);
    expect(chart[5]?.sessions).toBe(1);
    expect(chart[4]?.sessions).toBe(1);
  });

  it('keeps a session that falls on the changed day', () => {
    // A session late on the day the clocks go back must still be counted.
    const late = new Date(2026, 10, 1, 23, 30, 0, 0).getTime();
    const history = [entry(late)];

    const now = new Date(2026, 10, 1, 23, 45, 0, 0).getTime();
    const chart = focusMsByDay(history, 7, now);

    const total = chart.reduce((sum, bucket) => sum + bucket.sessions, 0);
    expect(total).toBe(1);
  });

  it('produces one bucket per day with no repeats', () => {
    const chart = focusMsByDay([], 7, localNoon(2026, 11, 1));

    const keys = chart.map((bucket) => bucket.dayKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(7);
  });
});
