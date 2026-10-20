import { MAX_HISTORY_ENTRIES, type SessionEntry } from '@/domain/history';
import { createRepository, isRecord, type Repository } from './repository';
import type { TimerPhase } from '@/domain/types';

/**
 * Persistence for the session history.
 *
 * The history is the user's record of what they actually did, so validation
 * is strict: an entry that does not describe a real phase is dropped rather
 * than patched, because a silently mis-stated duration would corrupt the
 * statistics.
 */

export const HISTORY_STORAGE_KEY = 'pomodoro-history';

const PHASES: readonly TimerPhase[] = ['work', 'shortBreak', 'longBreak'];

function isPhase(value: unknown): value is TimerPhase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Validates one history entry, returning `null` when it is unusable. */
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

/** Validates the whole history, dropping any entry that is unusable. */
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

/** The repository that owns the session history. */
export const historyRepository: Repository<readonly SessionEntry[]> =
  createRepository<readonly SessionEntry[]>({
    key: HISTORY_STORAGE_KEY,
    validate: validateHistory,
  });
