import type { TimerConfig, TimerPhase, TimerState, TimerStatus } from '@/domain/types';

/**
 * Persistence of the timer across reloads.
 *
 * Only the timer and its configuration are stored in Phase 3; session
 * history and task tracking arrive in Phase 4 and will use their own keys.
 */

export const TIMER_STORAGE_KEY = 'pomodoro-timer-state';

export interface PersistedTimer {
  readonly state: TimerState;
  readonly config: TimerConfig;
  /** When the snapshot was written, for diagnostics. */
  readonly savedAt: number;
}

const PHASES: readonly TimerPhase[] = ['work', 'shortBreak', 'longBreak'];
const STATUSES = ['idle', 'running', 'paused'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPhase(value: unknown): value is TimerPhase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is TimerStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

/** Validates a persisted timer state, rejecting anything malformed. */
export function isTimerState(value: unknown): value is TimerState {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStatus(value.status) &&
    isPhase(value.phase) &&
    (value.endsAt === null || isNumber(value.endsAt)) &&
    isNumber(value.remaining) &&
    isNumber(value.completedWorkSessions) &&
    isNumber(value.totalWorkSessions) &&
    isNumber(value.interruptions) &&
    isNumber(value.totalInterruptions)
  );
}

/** Validates a persisted timer configuration, rejecting anything malformed. */
export function isTimerConfig(value: unknown): value is TimerConfig {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNumber(value.workMs) &&
    isNumber(value.shortBreakMs) &&
    isNumber(value.longBreakMs) &&
    isNumber(value.longBreakInterval) &&
    typeof value.autoStartBreaks === 'boolean' &&
    typeof value.autoStartWork === 'boolean'
  );
}

/** Reads the persisted timer snapshot, or null when there is nothing valid. */
export function readPersistedTimer(): PersistedTimer | null {
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    if (!isTimerState(parsed.state) || !isTimerConfig(parsed.config)) {
      return null;
    }
    return {
      state: parsed.state,
      config: parsed.config,
      savedAt: isNumber(parsed.savedAt) ? parsed.savedAt : Date.now(),
    };
  } catch {
    // Corrupt or unavailable storage must never break startup.
    return null;
  }
}

/** Writes the timer snapshot to storage. */
export function writePersistedTimer(state: TimerState, config: TimerConfig): void {
  try {
    const payload: PersistedTimer = { state, config, savedAt: Date.now() };
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be full or unavailable; the timer keeps working in memory.
  }
}

/** Removes the persisted timer snapshot. */
export function clearPersistedTimer(): void {
  try {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
