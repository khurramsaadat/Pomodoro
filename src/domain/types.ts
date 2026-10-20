/**
 * The kind of block the timer is currently running.
 *
 * `work` is a focus session; the two break kinds differ only in length and in
 * which accent colour the UI uses.
 */
export type TimerPhase = 'work' | 'shortBreak' | 'longBreak';

/** The lifecycle of the timer. */
export type TimerStatus = 'idle' | 'running' | 'paused';

/**
 * Everything that determines the shape of a session cycle.
 *
 * Durations are milliseconds because the engine is deadline-based and works in
 * absolute time; converting to minutes is a presentation concern.
 */
export interface TimerConfig {
  /** Length of a focus session. */
  readonly workMs: number;
  /** Length of the short break between focus sessions. */
  readonly shortBreakMs: number;
  /** Length of the long break taken after a full set of focus sessions. */
  readonly longBreakMs: number;
  /** How many focus sessions are completed before a long break is due. */
  readonly longBreakInterval: number;
  /** Whether a break starts on its own when a focus session completes. */
  readonly autoStartBreaks: boolean;
  /** Whether the next focus session starts on its own when a break completes. */
  readonly autoStartWork: boolean;
}

/**
 * The complete, serialisable state of the timer.
 *
 * `endsAt` is the deadline of the running phase in epoch milliseconds. It is
 * the single source of truth for the remaining time: the countdown is always
 * derived as `endsAt - Date.now()` rather than by decrementing a counter, so
 * background-tab throttling cannot make the timer drift.
 */
export interface TimerState {
  readonly status: TimerStatus;
  readonly phase: TimerPhase;
  /** Epoch ms at which the current phase ends. `null` unless running. */
  readonly endsAt: number | null;
  /** Milliseconds left in the phase. Authoritative while paused or idle. */
  readonly remaining: number;
  /**
   * Time already banked in the current phase, excluding the segment that is
   * currently running.
   *
   * This is what makes the recorded time exact. A phase that was paused at
   * ten minutes and then resumed banked ten minutes before the pause; the
   * remaining fifteen minutes are still in `remaining`. Adding the two at
   * completion gives the phase's true elapsed time, which a simple
   * `endsAt - startedAt` would under-report across a pause.
   */
  readonly elapsedMs: number;
  /** Epoch ms at which the current running segment began. `null` while paused. */
  readonly startedAt: number | null;
  /** Focus sessions completed within the current cycle (resets after a long break). */
  readonly completedWorkSessions: number;
  /** Focus sessions completed since the timer was created. */
  readonly totalWorkSessions: number;
  /** Interruptions recorded for the phase in progress. */
  readonly interruptions: number;
  /** Interruptions recorded across the whole session. */
  readonly totalInterruptions: number;
}

/**
 * A phase that reached its deadline, together with the time it actually ran.
 *
 * This is the bridge between the timer and the session history. The duration
 * is the phase's *configured* length rather than `endedAt - startedAt`,
 * because a phase that was paused and resumed still occupies its full
 * duration: the resumed deadline is `resumeTime + remaining`, so the total
 * time the phase consumed is exactly the configured duration either way.
 */
export interface PhaseCompletion {
  /** The phase that finished. */
  readonly phase: TimerPhase;
  /** When the phase started, in epoch ms. */
  readonly startedAt: number;
  /** When the phase reached its deadline, in epoch ms. */
  readonly endedAt: number;
  /** The time the phase occupied, in milliseconds. */
  readonly durationMs: number;
  /** Interruptions recorded during the phase. */
  readonly interruptions: number;
}
