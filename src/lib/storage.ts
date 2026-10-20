import { MAX_LONG_BREAK_INTERVAL } from '@/domain/presets';
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

/**
 * Whether a value is a usable duration.
 *
 * A duration of zero or less would produce a timer that is over before it
 * starts, so such a value is rejected rather than stored.
 */
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Whether a value is a usable whole-number setting such as an interval. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
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
    isNumber(value.elapsedMs) &&
    (value.startedAt === null || isNumber(value.startedAt)) &&
    isNumber(value.completedWorkSessions) &&
    isNumber(value.totalWorkSessions) &&
    isNumber(value.completedFocusMs) &&
    isNumber(value.interruptions) &&
    isNumber(value.totalInterruptions)
  );
}

/**
 * Repairs a persisted timer state, filling in what a payload written by an
 * older build would be missing.
 *
 * A snapshot written before the focus time was tracked has no
 * `completedFocusMs` field. It is not corrupt — it is simply from an older
 * version — so it is repaired rather than discarded. The focus time is
 * back-filled from the session count and the configured focus length, which
 * is exactly the estimate the field replaced, so the number does not jump
 * when the app is upgraded.
 */
export function repairTimerState(value: unknown, config: TimerConfig): TimerState | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isNumber(value.completedFocusMs)) {
    const sessions = isNumber(value.totalWorkSessions) ? value.totalWorkSessions : 0;
    value = { ...value, completedFocusMs: sessions * config.workMs };
  }

  return isTimerState(value) ? value : null;
}

/** Validates a persisted timer configuration, rejecting anything malformed. */
export function isTimerConfig(value: unknown): value is TimerConfig {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isPositiveNumber(value.workMs) &&
    isPositiveNumber(value.shortBreakMs) &&
    isPositiveNumber(value.longBreakMs) &&
    isPositiveInteger(value.longBreakInterval) &&
    value.longBreakInterval <= MAX_LONG_BREAK_INTERVAL &&
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
    if (!isTimerConfig(parsed.config)) {
      return null;
    }

    // The state is repaired rather than rejected, so a snapshot written by
    // an older build still restores instead of being thrown away.
    const state = repairTimerState(parsed.state, parsed.config);
    if (state === null) {
      return null;
    }

    return {
      state,
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
