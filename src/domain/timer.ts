import type { TimerConfig, TimerPhase, TimerState, TimerStatus } from './types';

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
    completedWorkSessions: 0,
    totalWorkSessions: 0,
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
  };
}

/** Pauses a running timer, freezing the remaining time. */
export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') {
    return state;
  }
  return {
    ...state,
    status: 'paused',
    endsAt: null,
    remaining: remainingAt(state, now),
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
    remaining,
    completedWorkSessions,
    totalWorkSessions: workCompleted ? state.totalWorkSessions + 1 : state.totalWorkSessions,
    // A fresh phase starts without the previous phase's interruptions.
    interruptions: 0,
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
): { state: TimerState; completedPhase: TimerPhase } {
  const completedPhase = state.phase;
  const advanced = advance(state, config);
  const shouldAutoStart =
    completedPhase === 'work' ? config.autoStartBreaks : config.autoStartWork;

  return {
    state: shouldAutoStart ? start(advanced, now) : advanced,
    completedPhase,
  };
}

/** Resets the current phase to its full duration without changing the phase. */
export function resetPhase(state: TimerState, config: TimerConfig): TimerState {
  return {
    ...state,
    status: 'idle',
    endsAt: null,
    remaining: durationForPhase(state.phase, config),
    interruptions: 0,
  };
}

/**
 * Resets the whole session: back to an idle focus session with no progress.
 */
export function resetSession(state: TimerState, config: TimerConfig): TimerState {
  return {
    ...createInitialState(config),
    totalWorkSessions: state.totalWorkSessions,
    totalInterruptions: state.totalInterruptions,
  };
}

/**
 * Skips the current phase, moving to the next one without starting it.
 *
 * A skipped focus session is deliberately *not* counted as a completion:
 * skipping means abandoning the session, not finishing it. Because the
 * session was never completed it also cannot earn a long break, so the skip
 * always leads to a short break.
 */
export function skipPhase(state: TimerState, config: TimerConfig): TimerState {
  const phase: TimerPhase = state.phase === 'work' ? 'shortBreak' : 'work';

  return {
    ...state,
    status: 'idle',
    phase,
    endsAt: null,
    remaining: durationForPhase(phase, config),
    // The skipped session is void: it counts neither towards the session
    // total nor towards the current cycle.
    totalWorkSessions: state.totalWorkSessions,
    completedWorkSessions: state.completedWorkSessions,
    interruptions: 0,
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
