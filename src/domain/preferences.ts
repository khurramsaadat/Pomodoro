/**
 * User preferences that are not part of the timer itself.
 *
 * These are deliberately separate from `TimerConfig`: the configuration
 * describes *how long* a session runs, while preferences describe *how the
 * app behaves* around it. Keeping them apart means a change of behaviour
 * never silently rewrites the user's session lengths.
 */

import { normalizeSoundId, type SoundId } from './sounds';

/** The smallest daily goal, in focus sessions. */
export const MIN_DAILY_GOAL = 1;

/** The largest daily goal, in focus sessions. */
export const MAX_DAILY_GOAL = 20;

export interface Preferences {
  /** How many focus sessions the user aims to complete per day. */
  readonly dailyGoal: number;
  /** Whether the queue moves on by itself once a task's estimate is met. */
  readonly autoAdvanceTask: boolean;
  /** Whether the completion chime is played. */
  readonly soundEnabled: boolean;
  /** Which completion sound is played. */
  readonly completionSound: SoundId;
  /** Whether destructive actions ask for confirmation first. */
  readonly confirmBeforeClearing: boolean;
  /** Whether completed tasks stay visible in the queue. */
  readonly showCompletedTasks: boolean;
  /**
   * Whether the window stays above the other windows.
   *
   * A timer the user has to go looking for is a timer they will miss, so the
   * window can be pinned above everything else. It is a preference rather
   * than a fixed behaviour because it is a *choice*: a window that floats
   * over everything is helpful while you are working and an obstruction
   * while you are not.
   */
  readonly alwaysOnTop: boolean;
}

/** The preferences a first-time user gets. */
export const DEFAULT_PREFERENCES: Preferences = {
  dailyGoal: 8,
  autoAdvanceTask: true,
  soundEnabled: true,
  completionSound: 'chime',
  confirmBeforeClearing: true,
  showCompletedTasks: true,
  alwaysOnTop: false,
};

/** Clamps a daily goal into the supported range. */
export function clampDailyGoal(goal: number): number {
  if (!Number.isFinite(goal)) {
    return DEFAULT_PREFERENCES.dailyGoal;
  }
  return Math.min(MAX_DAILY_GOAL, Math.max(MIN_DAILY_GOAL, Math.round(goal)));
}

/**
 * Repairs an arbitrary value into a valid set of preferences.
 *
 * Every field falls back to its default independently, so a payload that is
 * mostly corrupt still yields a usable configuration rather than being
 * discarded wholesale.
 */
export function normalizePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_PREFERENCES;
  }

  const record = value as Record<string, unknown>;

  return {
    dailyGoal:
      typeof record.dailyGoal === 'number' && Number.isFinite(record.dailyGoal)
        ? clampDailyGoal(record.dailyGoal)
        : DEFAULT_PREFERENCES.dailyGoal,
    autoAdvanceTask:
      typeof record.autoAdvanceTask === 'boolean'
        ? record.autoAdvanceTask
        : DEFAULT_PREFERENCES.autoAdvanceTask,
    soundEnabled:
      typeof record.soundEnabled === 'boolean'
        ? record.soundEnabled
        : DEFAULT_PREFERENCES.soundEnabled,
    // A sound that no longer exists falls back to the default rather than
    // leaving the user with no cue at all.
    completionSound: normalizeSoundId(record.completionSound),
    confirmBeforeClearing:
      typeof record.confirmBeforeClearing === 'boolean'
        ? record.confirmBeforeClearing
        : DEFAULT_PREFERENCES.confirmBeforeClearing,
    showCompletedTasks:
      typeof record.showCompletedTasks === 'boolean'
        ? record.showCompletedTasks
        : DEFAULT_PREFERENCES.showCompletedTasks,
    alwaysOnTop:
      typeof record.alwaysOnTop === 'boolean' ? record.alwaysOnTop : DEFAULT_PREFERENCES.alwaysOnTop,
  };
}
