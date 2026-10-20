import { describe, expect, it } from 'vitest';

import {
  appendEntry,
  breakdownByTask,
  clearHistory,
  createSessionEntry,
  currentStreak,
  dailyProgress,
  focusMsByDay,
  focusMsForTask,
  focusMsOnDay,
  focusSessionCount,
  focusSessions,
  interruptionCount,
  MAX_HISTORY_ENTRIES,
  sessionsForTask,
  sessionsOnDay,
  sessionsToday,
  totalFocusMs,
  type SessionEntry,
} from '@/domain/history';
import { localDayKey } from '@/lib/time';

const MINUTE = 60_000;
const T0 = 1_700_000_000_000;

function entry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return createSessionEntry(`id-${Math.random().toString(36).slice(2)}`, {
    phase: 'work',
    startedAt: T0,
    endedAt: T0 + 25 * MINUTE,
    durationMs: 25 * MINUTE,
    taskId: null,
    taskTitle: null,
    interruptions: 0,
    voided: false,
    ...overrides,
  });
}

describe('appendEntry', () => {
  it('adds the newest entry first', () => {
    const first = entry({ taskTitle: 'First' });
    const second = entry({ taskTitle: 'Second' });

    const history = appendEntry(appendEntry([], first), second);

    expect(history[0]?.taskTitle).toBe('Second');
  });

  it('keeps the log bounded by dropping the oldest entries', () => {
    let history: SessionEntry[] = [];
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 10; index += 1) {
      history = appendEntry(history, entry({ taskTitle: `Task ${index}` }));
    }

    expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
    // The newest entry survived and the oldest was dropped.
    expect(history[0]?.taskTitle).toBe(`Task ${MAX_HISTORY_ENTRIES + 9}`);
  });
});

describe('clearHistory', () => {
  it('empties the log', () => {
    expect(clearHistory()).toEqual([]);
  });
});

describe('focusSessions', () => {
  it('excludes the breaks', () => {
    const history = [entry({ phase: 'work' }), entry({ phase: 'shortBreak' })];

    expect(focusSessions(history)).toHaveLength(1);
    expect(focusSessionCount(history)).toBe(1);
  });
});

describe('totalFocusMs', () => {
  it('sums the focus sessions only', () => {
    const history = [
      entry({ durationMs: 25 * MINUTE }),
      entry({ phase: 'shortBreak', durationMs: 5 * MINUTE }),
    ];

    expect(totalFocusMs(history)).toBe(25 * MINUTE);
  });
});

describe('interruptionCount', () => {
  it('sums the interruptions of the focus sessions', () => {
    const history = [
      entry({ interruptions: 2 }),
      entry({ interruptions: 1 }),
      entry({ phase: 'longBreak', interruptions: 5 }),
    ];

    expect(interruptionCount(history)).toBe(3);
  });
});

describe('sessionsOnDay', () => {
  it('groups the sessions by their local calendar day', () => {
    const history = [entry({ endedAt: T0 }), entry({ endedAt: T0 + 86_400_000 })];

    expect(sessionsOnDay(history, localDayKey(T0))).toHaveLength(1);
    expect(sessionsOnDay(history, localDayKey(T0 + 86_400_000))).toHaveLength(1);
  });
});

describe('sessionsToday', () => {
  it('counts the sessions completed today', () => {
    const history = [entry({ endedAt: T0 }), entry({ endedAt: T0 + 86_400_000 })];

    expect(sessionsToday(history, T0 + 1000)).toBe(1);
  });
});

describe('focusMsOnDay', () => {
  it('sums the focus time of a single day', () => {
    const history = [
      entry({ endedAt: T0, durationMs: 25 * MINUTE }),
      entry({ endedAt: T0, durationMs: 25 * MINUTE }),
      entry({ endedAt: T0 + 86_400_000, durationMs: 25 * MINUTE }),
    ];

    expect(focusMsOnDay(history, localDayKey(T0))).toBe(50 * MINUTE);
  });
});

describe('focusMsByDay', () => {
  it('returns one bucket per day in the window, oldest first', () => {
    const result = focusMsByDay([], 7, T0);

    expect(result).toHaveLength(7);
    expect(result[0]?.dayKey).toBe(localDayKey(T0 - 6 * 86_400_000));
    expect(result[6]?.dayKey).toBe(localDayKey(T0));
  });

  it('fills the buckets with the focus time of each day', () => {
    const history = [entry({ endedAt: T0, durationMs: 25 * MINUTE })];

    const result = focusMsByDay(history, 7, T0);

    expect(result[6]?.focusMs).toBe(25 * MINUTE);
    expect(result[6]?.sessions).toBe(1);
    expect(result[0]?.focusMs).toBe(0);
  });
});

describe('breakdownByTask', () => {
  it('groups the focus time by task, largest first', () => {
    const history = [
      entry({ taskId: 'a', taskTitle: 'Alpha', durationMs: 10 * MINUTE }),
      entry({ taskId: 'b', taskTitle: 'Beta', durationMs: 30 * MINUTE }),
      entry({ taskId: 'a', taskTitle: 'Alpha', durationMs: 5 * MINUTE }),
    ];

    const breakdown = breakdownByTask(history);

    expect(breakdown[0]?.taskTitle).toBe('Beta');
    expect(breakdown[0]?.focusMs).toBe(30 * MINUTE);
    expect(breakdown[1]?.taskTitle).toBe('Alpha');
    expect(breakdown[1]?.sessions).toBe(2);
    expect(breakdown[1]?.focusMs).toBe(15 * MINUTE);
  });

  it('buckets the sessions with no task separately', () => {
    const breakdown = breakdownByTask([entry()]);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]?.taskId).toBeNull();
    expect(breakdown[0]?.taskTitle).toBe('No task');
  });
});

describe('focusMsForTask', () => {
  it('sums the time spent on one task', () => {
    const history = [
      entry({ taskId: 'a', durationMs: 10 * MINUTE }),
      entry({ taskId: 'b', durationMs: 30 * MINUTE }),
      entry({ taskId: 'a', durationMs: 5 * MINUTE }),
    ];

    expect(focusMsForTask(history, 'a')).toBe(15 * MINUTE);
    expect(sessionsForTask(history, 'a')).toBe(2);
  });
});

describe('dailyProgress', () => {
  it('measures the sessions completed today against the goal', () => {
    const history = [entry({ endedAt: T0 }), entry({ endedAt: T0 })];

    const progress = dailyProgress(history, 4, T0 + 1000);

    expect(progress.sessions).toBe(2);
    expect(progress.goal).toBe(4);
    expect(progress.met).toBe(false);
    expect(progress.ratio).toBe(0.5);
  });

  it('reports the goal as met once it is reached', () => {
    const history = [entry({ endedAt: T0 }), entry({ endedAt: T0 })];

    const progress = dailyProgress(history, 2, T0 + 1000);

    expect(progress.met).toBe(true);
    expect(progress.ratio).toBe(1);
  });

  it('survives a goal of zero', () => {
    const progress = dailyProgress([], 0, T0);

    expect(progress.goal).toBe(1);
    expect(Number.isFinite(progress.ratio)).toBe(true);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days with a focus session', () => {
    const history = [
      entry({ endedAt: T0 }),
      entry({ endedAt: T0 - 86_400_000 }),
      entry({ endedAt: T0 - 2 * 86_400_000 }),
    ];

    expect(currentStreak(history, T0 + 1000)).toBe(3);
  });

  it('tolerates a day with no session yet today', () => {
    const history = [entry({ endedAt: T0 - 86_400_000 })];

    // Today has no sessions, but yesterday's run is still alive.
    expect(currentStreak(history, T0 + 1000)).toBe(1);
  });

  it('breaks on a gap further back', () => {
    const history = [
      entry({ endedAt: T0 }),
      // Yesterday is missing.
      entry({ endedAt: T0 - 2 * 86_400_000 }),
    ];

    expect(currentStreak(history, T0 + 1000)).toBe(1);
  });

  it('is zero with no history', () => {
    expect(currentStreak([], T0)).toBe(0);
  });
});
