import { localDayKey, shiftLocalDay } from '@/lib/time';
import { isNonNegativeNumber, isRecord } from './guards';
import type { TimerPhase } from './types';

/**
 * The session history: a record of every phase that ended.
 *
 * The history is the only durable record of what the user actually did, so it
 * is append-only. Entries are never mutated — a correction is a new entry —
 * which keeps the statistics reproducible from the log.
 */

/** A phase that ended, attributed to a task when there was one. */
export interface SessionEntry {
  readonly id: string;
  /** The phase that ended. */
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
  /**
   * Whether the phase was abandoned rather than completed.
   *
   * A voided entry records that a focus session was started and then given
   * up. It is kept in the log because the abandonment is real work of a kind
   * — it is the interruption — but it is excluded from every count of
   * *completed* sessions, so a skipped session still counts towards nothing.
   */
  readonly voided: boolean;
}

/** The most history entries that are kept. */
export const MAX_HISTORY_ENTRIES = 500;

/** The phases a history entry can describe. */
const PHASES: readonly TimerPhase[] = ['work', 'shortBreak', 'longBreak'];

function isPhase(value: unknown): value is TimerPhase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

/**
 * Validates one history entry, returning `null` when it is unusable.
 *
 * The check is strict: an entry that does not describe a real phase is
 * dropped rather than patched, because a silently mis-stated duration would
 * corrupt the statistics.
 */
export function validateSessionEntry(value: unknown): SessionEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, phase, startedAt, endedAt, durationMs, taskId, taskTitle, interruptions, voided } = value;

  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  if (!isPhase(phase)) {
    return null;
  }
  if (!isNonNegativeNumber(startedAt) || !isNonNegativeNumber(endedAt)) {
    return null;
  }
  if (!isNonNegativeNumber(durationMs)) {
    return null;
  }
  if (taskId !== null && typeof taskId !== 'string') {
    return null;
  }
  if (taskTitle !== null && typeof taskTitle !== 'string') {
    return null;
  }
  if (!isNonNegativeNumber(interruptions)) {
    return null;
  }
  // A payload written before the `voided` flag existed has no abandoned
  // sessions in it, so a missing flag means "not voided" rather than
  // "unusable" — an old history must not be thrown away.
  if (voided !== undefined && typeof voided !== 'boolean') {
    return null;
  }

  return {
    id,
    phase,
    startedAt,
    endedAt,
    durationMs,
    taskId,
    taskTitle,
    interruptions,
    voided: voided === true,
  };
}

/**
 * Validates the whole history, dropping any entry that is unusable.
 *
 * The log is bounded by the same cap the app applies when appending, so an
 * imported history cannot be larger than the one the app would have kept.
 */
export function validateHistory(value: unknown): SessionEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: SessionEntry[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const validated = validateSessionEntry(entry);
    if (validated && !seen.has(validated.id)) {
      seen.add(validated.id);
      entries.push(validated);
    }
  }

  return entries.slice(0, MAX_HISTORY_ENTRIES);
}

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

/**
 * The focus sessions in the history, in the order they were completed.
 *
 * Voided sessions are excluded: a session that was abandoned was never
 * completed, so it counts towards nothing — not towards the session total,
 * not towards the daily goal, and not towards the streak.
 */
export function focusSessions(history: readonly SessionEntry[]): SessionEntry[] {
  return history.filter((entry) => entry.phase === 'work' && !entry.voided);
}

/**
 * The focus sessions that were started and then abandoned.
 *
 * These are the interruptions. They are counted separately because they are
 * the sessions that did *not* happen, and a method is only working when the
 * abandoned ones are visible.
 */
export function voidedSessions(history: readonly SessionEntry[]): SessionEntry[] {
  return history.filter((entry) => entry.voided);
}

/** The total time spent focusing, in milliseconds. */
export function totalFocusMs(history: readonly SessionEntry[]): number {
  return focusSessions(history).reduce((total, entry) => total + entry.durationMs, 0);
}

/** The number of focus sessions completed. */
export function focusSessionCount(history: readonly SessionEntry[]): number {
  return focusSessions(history).length;
}

/**
 * The number of interruptions recorded across all focus sessions.
 *
 * A session that was abandoned is itself an interruption, so the voided
 * entries are counted here. Without them the metric would only ever report
 * the interruptions the user marked by hand, and a skipped session — the
 * most obvious interruption of all — would be invisible.
 */
export function interruptionCount(history: readonly SessionEntry[]): number {
  const marked = focusSessions(history).reduce(
    (total, entry) => total + entry.interruptions,
    0,
  );
  return marked + voidedSessions(history).length;
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
  // silently dropping them. The window steps back by calendar day, so a
  // daylight-saving change cannot shift the buckets off the days they
  // belong to.
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    buckets.set(localDayKey(shiftLocalDay(now, offset)), { focusMs: 0, sessions: 0 });
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

/** Today's progress against a goal that may count sessions or minutes. */
export interface DailyGoalProgress {
  readonly sessions: number;
  readonly focusMs: number;
  /** The goal, in the unit the mode names. */
  readonly goal: number;
  readonly met: boolean;
  readonly ratio: number;
  readonly mode: 'sessions' | 'minutes';
}

/**
 * Measures today's progress against the daily goal, in the unit the user
 * chose.
 *
 * A goal of eight sessions treats a day of eight sprints and a day of eight
 * long sessions as the same day, which they are not. The measured focus time
 * is already banked, so the minute goal is a real measurement rather than an
 * estimate: it is the time the phases actually served.
 */
export function dailyGoalProgress(
  history: readonly SessionEntry[],
  options: {
    readonly mode: 'sessions' | 'minutes';
    readonly sessionsGoal: number;
    readonly minutesGoal: number;
  },
  now: number,
): DailyGoalProgress {
  const dayKey = localDayKey(now);
  const sessions = sessionsOnDay(history, dayKey).length;
  const focusMs = focusMsOnDay(history, dayKey);

  if (options.mode === 'minutes') {
    const goal = options.minutesGoal > 0 ? options.minutesGoal : 1;
    const minutes = focusMs / 60_000;

    return {
      sessions,
      focusMs,
      goal,
      met: minutes >= goal,
      ratio: Math.min(1, minutes / goal),
      mode: 'minutes',
    };
  }

  const goal = options.sessionsGoal > 0 ? options.sessionsGoal : 1;

  return {
    sessions,
    focusMs,
    goal,
    met: sessions >= goal,
    ratio: Math.min(1, sessions / goal),
    mode: 'sessions',
  };
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
 *
 * The walk steps back by *calendar* day rather than by 86 400 000 ms. A day
 * is 23 or 25 hours long across a daylight-saving boundary, so a fixed step
 * would visit one day twice and skip another, and the streak would be wrong
 * for every user in a zone that observes the change.
 */
export function currentStreak(history: readonly SessionEntry[], now: number): number {
  const days = new Set(focusSessions(history).map((entry) => localDayKey(entry.endedAt)));

  let streak = 0;
  let offset = 0;

  while (streak < days.size) {
    const key = localDayKey(shiftLocalDay(now, offset));

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
