import { localDayKey } from '@/lib/time';
import type { TimerPhase } from './types';

/**
 * The session history: a record of every phase that reached its deadline.
 *
 * The history is the only durable record of what the user actually did, so it
 * is append-only. Entries are never mutated — a correction is a new entry —
 * which keeps the statistics reproducible from the log.
 */

/** A completed focus session, attributed to a task when there was one. */
export interface SessionEntry {
  readonly id: string;
  /** The phase that completed. */
  readonly phase: TimerPhase;
  /** When the phase started, in epoch ms. */
  readonly startedAt: number;
  /** When the phase reached its deadline, in epoch ms. */
  readonly endedAt: number;
  /** The time the phase occupied, in milliseconds. */
  readonly durationMs: number;
  /** The task this session was spent on. `null` when there was no active task. */
  readonly taskId: string | null;
  /** The title of the task, captured so history survives a task being deleted. */
  readonly taskTitle: string | null;
  /** Interruptions recorded during the phase. */
  readonly interruptions: number;
}

/** The most history entries that are kept. */
export const MAX_HISTORY_ENTRIES = 500;

/** Builds a history entry from a completed phase. */
export function createSessionEntry(
  id: string,
  input: Omit<SessionEntry, 'id'>,
): SessionEntry {
  return { id, ...input };
}

/**
 * Adds an entry to the history, keeping the log bounded.
 *
 * The oldest entries are dropped once the log exceeds the cap, because the
 * history is a rolling window rather than an audit trail.
 */
export function appendEntry(
  history: readonly SessionEntry[],
  entry: SessionEntry,
): SessionEntry[] {
  const next = [entry, ...history];
  return next.length > MAX_HISTORY_ENTRIES ? next.slice(0, MAX_HISTORY_ENTRIES) : next;
}

/** Removes every entry from the history. */
export function clearHistory(): SessionEntry[] {
  return [];
}

/** The focus sessions in the history, in the order they were completed. */
export function focusSessions(history: readonly SessionEntry[]): SessionEntry[] {
  return history.filter((entry) => entry.phase === 'work');
}

/** The total time spent focusing, in milliseconds. */
export function totalFocusMs(history: readonly SessionEntry[]): number {
  return focusSessions(history).reduce((total, entry) => total + entry.durationMs, 0);
}

/** The number of focus sessions completed. */
export function focusSessionCount(history: readonly SessionEntry[]): number {
  return focusSessions(history).length;
}

/** The number of interruptions recorded across all focus sessions. */
export function interruptionCount(history: readonly SessionEntry[]): number {
  return focusSessions(history).reduce((total, entry) => total + entry.interruptions, 0);
}

/** The focus sessions completed on a given local calendar day. */
export function sessionsOnDay(
  history: readonly SessionEntry[],
  dayKey: string,
): SessionEntry[] {
  return focusSessions(history).filter((entry) => localDayKey(entry.endedAt) === dayKey);
}

/** The number of focus sessions completed today. */
export function sessionsToday(history: readonly SessionEntry[], now: number): number {
  return sessionsOnDay(history, localDayKey(now)).length;
}

/** The total focus time on a given local calendar day, in milliseconds. */
export function focusMsOnDay(
  history: readonly SessionEntry[],
  dayKey: string,
): number {
  return sessionsOnDay(history, dayKey).reduce((total, entry) => total + entry.durationMs, 0);
}

/** The focus time of the last `days` days, oldest first, keyed by day. */
export function focusMsByDay(
  history: readonly SessionEntry[],
  days: number,
  now: number,
): { dayKey: string; focusMs: number; sessions: number }[] {
  const buckets = new Map<string, { focusMs: number; sessions: number }>();

  // Seed every day in the window so the chart shows gaps as zero rather than
  // silently dropping them.
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    buckets.set(localDayKey(now - offset * 86_400_000), { focusMs: 0, sessions: 0 });
  }

  for (const entry of focusSessions(history)) {
    const key = localDayKey(entry.endedAt);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.focusMs += entry.durationMs;
      bucket.sessions += 1;
    }
  }

  return [...buckets.entries()].map(([dayKey, bucket]) => ({ dayKey, ...bucket }));
}

/** How the focus time is spread across the tasks it was spent on. */
export interface TaskBreakdown {
  readonly taskId: string | null;
  readonly taskTitle: string;
  readonly sessions: number;
  readonly focusMs: number;
}

/**
 * Breaks the focus time down by task.
 *
 * The breakdown is sorted by time spent, so the task the user is actually
 * working on is at the top.
 */
export function breakdownByTask(history: readonly SessionEntry[]): TaskBreakdown[] {
  const buckets = new Map<string, TaskBreakdown>();

  for (const entry of focusSessions(history)) {
    const key = entry.taskId ?? '__unassigned__';
    const existing = buckets.get(key);

    if (existing) {
      buckets.set(key, {
        ...existing,
        sessions: existing.sessions + 1,
        focusMs: existing.focusMs + entry.durationMs,
      });
    } else {
      buckets.set(key, {
        taskId: entry.taskId,
        taskTitle: entry.taskTitle ?? 'No task',
        sessions: 1,
        focusMs: entry.durationMs,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => b.focusMs - a.focusMs);
}

/** The focus time of a single task, in milliseconds. */
export function focusMsForTask(
  history: readonly SessionEntry[],
  taskId: string,
): number {
  return focusSessions(history)
    .filter((entry) => entry.taskId === taskId)
    .reduce((total, entry) => total + entry.durationMs, 0);
}

/** The number of focus sessions spent on a single task. */
export function sessionsForTask(history: readonly SessionEntry[], taskId: string): number {
  return focusSessions(history).filter((entry) => entry.taskId === taskId).length;
}

/** A snapshot of the user's progress against their daily goal. */
export interface DailyProgress {
  readonly sessions: number;
  readonly goal: number;
  readonly focusMs: number;
  /** Whether the daily goal has been met. */
  readonly met: boolean;
  /** The share of the goal that has been met, from 0 to 1. */
  readonly ratio: number;
}

/** Measures today's progress against the daily goal. */
export function dailyProgress(
  history: readonly SessionEntry[],
  goal: number,
  now: number,
): DailyProgress {
  const dayKey = localDayKey(now);
  const sessions = sessionsOnDay(history, dayKey).length;
  const focusMs = focusMsOnDay(history, dayKey);
  const safeGoal = goal > 0 ? goal : 1;

  return {
    sessions,
    goal: safeGoal,
    focusMs,
    met: sessions >= safeGoal,
    ratio: Math.min(1, sessions / safeGoal),
  };
}

/**
 * A short streak of consecutive days with at least one focus session.
 *
 * The streak counts back from today. Today not having a session yet does not
 * break the streak — the day is not over — but any gap further back does.
 */
export function currentStreak(history: readonly SessionEntry[], now: number): number {
  const days = new Set(focusSessions(history).map((entry) => localDayKey(entry.endedAt)));

  let streak = 0;
  let offset = 0;

  while (streak < days.size) {
    const key = localDayKey(now - offset * 86_400_000);

    if (!days.has(key)) {
      // Today may legitimately be empty, so only a gap on an earlier day ends
      // the streak.
      if (offset === 0) {
        offset += 1;
        continue;
      }
      break;
    }

    streak += 1;
    offset += 1;
  }

  return streak;
}
