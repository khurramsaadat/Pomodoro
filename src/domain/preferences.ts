/**
 * User preferences that are not part of the timer itself.
 *
 * These are deliberately separate from `TimerConfig`: the configuration
 * describes *how long* a session runs, while preferences describe *how the
 * app behaves* around it. Keeping them apart means a change of behaviour
 * never silently rewrites the user's session lengths.
 */

import {
  clampAmbienceVolume,
  DEFAULT_AMBIENCE,
  DEFAULT_AMBIENCE_VOLUME,
  normalizeAmbienceId,
  type AmbienceId,
} from './ambience';
import { normalizeSoundId, type SoundId } from './sounds';

/** The smallest daily goal, in focus sessions. */
export const MIN_DAILY_GOAL = 1;

/** The largest daily goal, in focus sessions. */
export const MAX_DAILY_GOAL = 20;

/** The unit the daily goal is counted in. */
export type DailyGoalMode = 'sessions' | 'minutes';

/** The smallest daily goal, in focus minutes. */
export const MIN_DAILY_GOAL_MINUTES = 15;

/** The largest daily goal, in focus minutes. */
export const MAX_DAILY_GOAL_MINUTES = 720;

/** The default daily goal, in focus minutes: two hours. */
export const DEFAULT_DAILY_GOAL_MINUTES = 120;

/**
 * Which phases the background sound plays through.
 *
 * A user who chose rain to work under did not necessarily choose rain for
 * the break, which is when the room should come back.
 */
export type AmbienceScope = 'focus' | 'breaks' | 'both';

export interface Preferences {
  /** How many focus sessions the user aims to complete per day. */
  readonly dailyGoal: number;
  /** Whether the daily goal counts sessions or measured focus minutes. */
  readonly dailyGoalMode: DailyGoalMode;
  /** How many focus minutes the user aims for per day. */
  readonly dailyGoalMinutes: number;
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
  /**
   * The background sound played while a session runs.
   *
   * `none` is the default: a sound that starts without being asked for is
   * a surprise, and a surprise in a focus timer is a distraction.
   */
  readonly backgroundSound: AmbienceId;
  /** How loud the background sound is, from 0 to 1. */
  readonly backgroundVolume: number;
  /** Which phases the background sound plays through. */
  readonly ambienceScope: AmbienceScope;
  /**
   * Whether the pin follows the phase.
   *
   * When the window is pinned and this is on, it stays above the others
   * through a focus session and steps back during a break — the stretch
   * when the user is looking at something else.
   */
  readonly alwaysOnTopFollowsPhase: boolean;
  /**
   * Whether a notification is raised when a phase ends.
   *
   * The desktop tier's notification is raised by the host, so it survives a
   * window that is in the background; the browser's is raised by the page.
   */
  readonly notificationsEnabled: boolean;
  /**
   * Whether the window asks for the user's attention when a phase ends.
   *
   * This is the taskbar flash: the window is not brought forward, because a
   * timer that steals focus is a timer that interrupts the very work it was
   * set up to protect. The window is only *asked* to be noticed.
   */
  readonly attentionEnabled: boolean;
}

/** The preferences a first-time user gets. */
export const DEFAULT_PREFERENCES: Preferences = {
  dailyGoal: 8,
  dailyGoalMode: 'sessions',
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  autoAdvanceTask: true,
  soundEnabled: true,
  completionSound: 'chime',
  confirmBeforeClearing: true,
  showCompletedTasks: true,
  alwaysOnTop: false,
  backgroundSound: DEFAULT_AMBIENCE,
  backgroundVolume: DEFAULT_AMBIENCE_VOLUME,
  ambienceScope: 'both',
  alwaysOnTopFollowsPhase: false,
  notificationsEnabled: true,
  attentionEnabled: true,
};

/** Clamps a daily goal in minutes into the supported range. */
export function clampDailyGoalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_DAILY_GOAL_MINUTES;
  }
  return Math.min(MAX_DAILY_GOAL_MINUTES, Math.max(MIN_DAILY_GOAL_MINUTES, Math.round(minutes)));
}

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
    dailyGoalMode: record.dailyGoalMode === 'minutes' ? 'minutes' : 'sessions',
    dailyGoalMinutes:
      typeof record.dailyGoalMinutes === 'number' && Number.isFinite(record.dailyGoalMinutes)
        ? clampDailyGoalMinutes(record.dailyGoalMinutes)
        : DEFAULT_PREFERENCES.dailyGoalMinutes,
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
    // An ambience that no longer exists falls back to silence rather than
    // to a sound the user never chose.
    backgroundSound: normalizeAmbienceId(record.backgroundSound),
    backgroundVolume:
      typeof record.backgroundVolume === 'number'
        ? clampAmbienceVolume(record.backgroundVolume)
        : DEFAULT_PREFERENCES.backgroundVolume,
    ambienceScope:
      record.ambienceScope === 'focus' || record.ambienceScope === 'breaks'
        ? record.ambienceScope
        : 'both',
    alwaysOnTopFollowsPhase:
      typeof record.alwaysOnTopFollowsPhase === 'boolean'
        ? record.alwaysOnTopFollowsPhase
        : DEFAULT_PREFERENCES.alwaysOnTopFollowsPhase,
    notificationsEnabled:
      typeof record.notificationsEnabled === 'boolean'
        ? record.notificationsEnabled
        : DEFAULT_PREFERENCES.notificationsEnabled,
    attentionEnabled:
      typeof record.attentionEnabled === 'boolean'
        ? record.attentionEnabled
        : DEFAULT_PREFERENCES.attentionEnabled,
  };
}
