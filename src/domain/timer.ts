import type { PhaseCompletion, TimerConfig, TimerPhase, TimerState, TimerStatus } from './types';

/**
 * The pure timer engine.
 *
 * Every function here is a total function over plain data: no DOM access, no
 * timers, no side effects. The React layer owns the wall clock and calls these
 * functions to derive state, which makes the whole engine trivially testable
 * and keeps it identical across the web and desktop tiers.
 *
 * The central rule: remaining time is always derived from an absolute
 * deadline (`endsAt`), never from decrementing a counter. A background tab
 * that gets throttled therefore cannot make the countdown drift.
 */

/** The initial state: idle, on a focus session, with the full duration left. */
export function createInitialState(config: TimerConfig): TimerState {
  return {
    status: 'idle',
    phase: 'work',
    endsAt: null,
    remaining: config.workMs,
    elapsedMs: 0,
    startedAt: null,
    completedWorkSessions: 0,
    totalWorkSessions: 0,
    completedFocusMs: 0,
    interruptions: 0,
    totalInterruptions: 0,
  };
}

/** The duration of a phase under the given configuration. */
export function durationForPhase(phase: TimerPhase, config: TimerConfig): number {
  switch (phase) {
    case 'work':
      return config.workMs;
    case 'shortBreak':
      return config.shortBreakMs;
    case 'longBreak':
      return config.longBreakMs;
  }
}

/**
 * The phase that follows a phase that was completed normally.
 *
 * `completedWorkSessions` is the number of focus sessions completed
 * *including* the one that just finished. A focus session is followed by a
 * break — a long break once that count reaches a multiple of the interval,
 * otherwise a short one. A break is always followed by a focus session.
 */
export function nextPhase(
  phase: TimerPhase,
  completedWorkSessions: number,
  config: TimerConfig,
): TimerPhase {
  if (phase === 'work') {
    return isLongBreakDue(completedWorkSessions, config) ? 'longBreak' : 'shortBreak';
  }
  return 'work';
}

/**
 * Derives the remaining time for a running timer.
 *
 * `now` is passed in rather than read from the clock so that the function
 * stays pure and can be tested with fixed timestamps.
 */
export function remainingAt(state: TimerState, now: number): number {
  if (state.status !== 'running' || state.endsAt === null) {
    return state.remaining;
  }
  return Math.max(0, state.endsAt - now);
}

/** Whether the running phase has reached its deadline. */
export function hasExpired(state: TimerState, now: number): boolean {
  if (state.status !== 'running' || state.endsAt === null) {
    return false;
  }
  return now >= state.endsAt;
}

/** Starts (or resumes) the current phase, setting an absolute deadline. */
export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') {
    return state;
  }
  return {
    ...state,
    status: 'running',
    endsAt: now + state.remaining,
    startedAt: now,
  };
}

/**
 * Pauses a running timer, freezing the remaining time.
 *
 * The time served since the current segment started is banked into
 * `elapsedMs`, so a phase that is paused and later resumed still adds up to
 * its full duration.
 */
export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') {
    return state;
  }
  const served = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);

  return {
    ...state,
    status: 'paused',
    endsAt: null,
    startedAt: null,
    remaining: remainingAt(state, now),
    elapsedMs: state.elapsedMs + served,
  };
}

/**
 * Records an interruption against the phase in progress.
 *
 * In the Pomodoro method an interrupted focus session is void, so this is
 * tracked as a first-class metric rather than an afterthought.
 */
export function recordInterruption(state: TimerState): TimerState {
  return {
    ...state,
    interruptions: state.interruptions + 1,
    totalInterruptions: state.totalInterruptions + 1,
  };
}

/**
 * Advances to the next phase.
 *
 * `completedWorkSessions` is incremented when a focus session ends, which is
 * what decides whether the upcoming break is short or long.
 */
export function advance(state: TimerState, config: TimerConfig): TimerState {
  const workCompleted = state.phase === 'work';
  const completedWorkSessions = workCompleted
    ? state.completedWorkSessions + 1
    : state.completedWorkSessions;
  // The phase is chosen from the count that includes the session that just
  // completed, so a full set lands on a long break.
  const phase = nextPhase(state.phase, completedWorkSessions, config);
  const remaining = durationForPhase(phase, config);

  return {
    ...state,
    status: 'idle',
    phase,
    endsAt: null,
    startedAt: null,
    remaining,
    // A fresh phase starts with nothing banked and without the previous
    // phase's interruptions.
    elapsedMs: 0,
    completedWorkSessions,
    totalWorkSessions: workCompleted ? state.totalWorkSessions + 1 : state.totalWorkSessions,
    interruptions: 0,
  };
}

/**
 * Banks a measured focus duration against the session.
 *
 * The focus time is banked from the time the phase *actually* occupied, not
 * from the count of sessions multiplied by the configured length. The two
 * agree only while the focus length stays the same; an estimate that changes
 * with the settings is not a measurement.
 *
 * Banking is separate from `advance` because the measured duration is only
 * known once the phase has finished, and the catch-up replays phases that
 * ran unattended.
 */
export function bankFocusTime(state: TimerState, durationMs: number): TimerState {
  return {
    ...state,
    completedFocusMs: state.completedFocusMs + Math.max(0, durationMs),
  };
}

/**
 * Builds the record of a phase that has just reached its deadline.
 *
 * The duration is the time the phase actually occupied: the banked
 * `elapsedMs` plus the segment that was running when the deadline was hit.
 * Summing the two is what makes the figure exact across pauses, where a
 * naive `endsAt - startedAt` would only see the final segment.
 */
export function phaseCompletion(
  state: TimerState,
  config: TimerConfig,
  now: number,
): PhaseCompletion {
  const duration = durationForPhase(state.phase, config);
  const finalSegment = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  const served = Math.min(duration, state.elapsedMs + finalSegment);

  return {
    phase: state.phase,
    startedAt: state.startedAt ?? now - served,
    endedAt: now,
    durationMs: served,
    interruptions: state.interruptions,
    voided: false,
  };
}

/**
 * Advances to the next phase and starts it if the configuration allows.
 *
 * This is the transition applied when a phase reaches its deadline.
 */
export function completePhase(
  state: TimerState,
  config: TimerConfig,
  now: number,
): { state: TimerState; completedPhase: TimerPhase; completion: PhaseCompletion } {
  const completedPhase = state.phase;
  const completion = phaseCompletion(state, config, now);
  const advanced = advance(state, config);
  const shouldAutoStart =
    completedPhase === 'work' ? config.autoStartBreaks : config.autoStartWork;

  // The focus time is banked from the measured duration of the phase that
  // just finished, so the summary shows what was actually spent focusing.
  const banked =
    completedPhase === 'work' ? bankFocusTime(advanced, completion.durationMs) : advanced;

  return {
    state: shouldAutoStart ? start(banked, now) : banked,
    completedPhase,
    completion,
  };
}

/** Resets the current phase to its full duration without changing the phase. */
export function resetPhase(state: TimerState, config: TimerConfig): TimerState {
  return {
    ...state,
    status: 'idle',
    endsAt: null,
    startedAt: null,
    remaining: durationForPhase(state.phase, config),
    elapsedMs: 0,
    interruptions: 0,
  };
}

/**
 * Resets the whole session: back to an idle focus session with no progress.
 *
 * The counters are cleared as well as the cycle. The session summary shows
 * the session's focus sessions, its focus time and its interruptions, so
 * keeping them would leave the panel looking exactly as it did before the
 * button was pressed.
 *
 * The recorded history is *not* touched: the log is append-only, and the
 * sessions that really happened stay in it whatever the timer is reset to.
 */
export function resetSession(config: TimerConfig): TimerState {
  return createInitialState(config);
}

/**
 * Skips the current phase, moving to the next one without starting it.
 *
 * A skipped focus session is deliberately *not* counted as a completion:
 * skipping means abandoning the session, not finishing it. Because the
 * session was never completed it also cannot earn a long break, so the skip
 * always leads to a short break.
 *
 * It *is* counted as an interruption, though. A focus session that was
 * started and then given up is exactly what the method calls an
 * interruption, and a phase that was never started at all is not — so
 * only a phase that had actually begun is voided.
 *
 * The voided phase is returned as a completion record so the caller can
 * write it into the history. The history is where the interruption becomes
 * visible in the statistics; without it the metric could never be non-zero.
 */
export function skipPhase(
  state: TimerState,
  config: TimerConfig,
  now: number,
): { state: TimerState; completion: PhaseCompletion | null } {
  const hadStarted = state.status !== 'idle' || state.elapsedMs > 0;
  const abandonedWork = state.phase === 'work' && hadStarted;

  const completion: PhaseCompletion | null = abandonedWork
    ? { ...phaseCompletion(state, config, now), voided: true }
    : null;

  const phase: TimerPhase = state.phase === 'work' ? 'shortBreak' : 'work';

  return {
    state: {
      ...state,
      status: 'idle',
      phase,
      endsAt: null,
      startedAt: null,
      remaining: durationForPhase(phase, config),
      elapsedMs: 0,
      // The skipped session is void: it counts neither towards the session
      // total nor towards the current cycle.
      totalWorkSessions: state.totalWorkSessions,
      completedWorkSessions: state.completedWorkSessions,
      // Abandoning a focus session is an interruption, so it is counted.
      totalInterruptions: abandonedWork ? state.totalInterruptions + 1 : state.totalInterruptions,
      interruptions: 0,
    },
    completion,
  };
}

/** The number of focus sessions in the current set, for the cycle indicator. */
export function cycleProgress(state: TimerState, config: TimerConfig): {
  completed: number;
  total: number;
} {
  return {
    completed: state.completedWorkSessions % config.longBreakInterval,
    total: config.longBreakInterval,
  };
}

/** Whether a long break is due after the given number of completed focus sessions. */
export function isLongBreakDue(completedWorkSessions: number, config: TimerConfig): boolean {
  return completedWorkSessions > 0 && completedWorkSessions % config.longBreakInterval === 0;
}

/** A human-readable label for a phase. */
export function phaseLabel(phase: TimerPhase): string {
  switch (phase) {
    case 'work':
      return 'Focus';
    case 'shortBreak':
      return 'Short break';
    case 'longBreak':
      return 'Long break';
  }
}

/** A human-readable label for the timer's status. */
export function statusLabel(status: TimerStatus): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
  }
}
