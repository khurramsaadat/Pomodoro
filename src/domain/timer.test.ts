import { describe, expect, it } from 'vitest';

import { configFromPreset, defaultPreset, TIMER_PRESETS } from '@/domain/presets';
import {
  advance,
  completePhase,
  createInitialState,
  cycleProgress,
  durationForPhase,
  hasExpired,
  isLongBreakDue,
  nextPhase,
  pause,
  phaseCompletion,
  phaseLabel,
  recordInterruption,
  remainingAt,
  resetPhase,
  resetSession,
  skipPhase,
  start,
  statusLabel,
} from '@/domain/timer';
import type { TimerConfig, TimerState } from '@/domain/types';

const MINUTE = 60_000;
const T0 = 1_700_000_000_000;

function makeConfig(overrides: Partial<TimerConfig> = {}): TimerConfig {
  return {
    workMs: 25 * MINUTE,
    shortBreakMs: 5 * MINUTE,
    longBreakMs: 15 * MINUTE,
    longBreakInterval: 4,
    autoStartBreaks: true,
    autoStartWork: false,
    ...overrides,
  };
}

/**
 * Advances the timer until `count` focus sessions have been completed.
 *
 * Each call to `advance` moves one phase, so a full cycle is two calls per
 * focus session: one to finish the session and one to leave the break.
 */
function completeFocusSessions(
  state: TimerState,
  config: TimerConfig,
  count: number,
): TimerState {
  let current = state;
  let guard = 0;

  while (current.completedWorkSessions < count && guard < 100) {
    current = advance(current, config);
    guard += 1;
  }

  return current;
}

describe('createInitialState', () => {
  it('starts idle on a focus session with the full duration', () => {
    const state = createInitialState(makeConfig());

    expect(state.status).toBe('idle');
    expect(state.phase).toBe('work');
    expect(state.endsAt).toBeNull();
    expect(state.remaining).toBe(25 * MINUTE);
    expect(state.completedWorkSessions).toBe(0);
    expect(state.totalWorkSessions).toBe(0);
  });
});

describe('start', () => {
  it('sets an absolute deadline rather than decrementing a counter', () => {
    const state = start(createInitialState(makeConfig()), T0);

    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(T0 + 25 * MINUTE);
  });

  it('is idempotent while already running', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const again = start(running, T0 + 1000);

    expect(again).toBe(running);
  });

  it('resumes from the frozen remaining time after a pause', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const paused = pause(running, T0 + 10 * MINUTE);
    const resumed = start(paused, T0 + 20 * MINUTE);

    expect(resumed.status).toBe('running');
    expect(resumed.endsAt).toBe(T0 + 20 * MINUTE + 15 * MINUTE);
  });
});

describe('remainingAt', () => {
  it('derives the remaining time from the deadline', () => {
    const state = start(createInitialState(makeConfig()), T0);

    expect(remainingAt(state, T0)).toBe(25 * MINUTE);
    expect(remainingAt(state, T0 + 5 * MINUTE)).toBe(20 * MINUTE);
  });

  it('never returns a negative value once the deadline has passed', () => {
    const state = start(createInitialState(makeConfig()), T0);

    expect(remainingAt(state, T0 + 30 * MINUTE)).toBe(0);
  });

  it('ignores the clock while the timer is paused', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const paused = pause(running, T0 + 5 * MINUTE);

    expect(remainingAt(paused, T0 + 60 * MINUTE)).toBe(20 * MINUTE);
  });
});

describe('hasExpired', () => {
  it('is false before the deadline and true at or after it', () => {
    const state = start(createInitialState(makeConfig()), T0);

    expect(hasExpired(state, T0 + 25 * MINUTE - 1)).toBe(false);
    expect(hasExpired(state, T0 + 25 * MINUTE)).toBe(true);
    expect(hasExpired(state, T0 + 26 * MINUTE)).toBe(true);
  });

  it('is false for a paused timer', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const paused = pause(running, T0);

    expect(hasExpired(paused, T0 + 100 * MINUTE)).toBe(false);
  });
});

describe('pause', () => {
  it('freezes the remaining time and clears the deadline', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const paused = pause(running, T0 + 5 * MINUTE);

    expect(paused.status).toBe('paused');
    expect(paused.endsAt).toBeNull();
    expect(paused.remaining).toBe(20 * MINUTE);
  });

  it('ignores a timer that is not running', () => {
    const idle = createInitialState(makeConfig());

    expect(pause(idle, T0)).toBe(idle);
  });
});

describe('nextPhase', () => {
  it('follows a focus session with a short break', () => {
    expect(nextPhase('work', 1, makeConfig())).toBe('shortBreak');
    expect(nextPhase('work', 2, makeConfig())).toBe('shortBreak');
  });

  it('follows a full set of focus sessions with a long break', () => {
    expect(nextPhase('work', 4, makeConfig())).toBe('longBreak');
    expect(nextPhase('work', 8, makeConfig())).toBe('longBreak');
  });

  it('always follows a break with a focus session', () => {
    expect(nextPhase('shortBreak', 1, makeConfig())).toBe('work');
    expect(nextPhase('longBreak', 4, makeConfig())).toBe('work');
  });
});

describe('advance', () => {
  it('counts a completed focus session', () => {
    const advanced = advance(createInitialState(makeConfig()), makeConfig());

    expect(advanced.phase).toBe('shortBreak');
    expect(advanced.completedWorkSessions).toBe(1);
    expect(advanced.totalWorkSessions).toBe(1);
    expect(advanced.remaining).toBe(5 * MINUTE);
    expect(advanced.status).toBe('idle');
  });

  it('does not count a break as a focus session', () => {
    const state: TimerState = {
      ...createInitialState(makeConfig()),
      phase: 'shortBreak',
      completedWorkSessions: 1,
      totalWorkSessions: 1,
    };

    const advanced = advance(state, makeConfig());

    expect(advanced.phase).toBe('work');
    expect(advanced.completedWorkSessions).toBe(1);
    expect(advanced.totalWorkSessions).toBe(1);
  });

  it('reaches a long break after a full set', () => {
    const config = makeConfig();
    const state = completeFocusSessions(createInitialState(config), config, 4);

    expect(state.completedWorkSessions).toBe(4);
    expect(state.phase).toBe('longBreak');
    expect(state.remaining).toBe(15 * MINUTE);
  });
});

describe('completePhase', () => {
  it('auto-starts the break when configured to', () => {
    const config = makeConfig({ autoStartBreaks: true });
    const { state, completedPhase } = completePhase(
      start(createInitialState(config), T0),
      config,
      T0 + 25 * MINUTE,
    );

    expect(completedPhase).toBe('work');
    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(T0 + 25 * MINUTE + 5 * MINUTE);
  });

  it('waits for the user when auto-start is disabled', () => {
    const config = makeConfig({ autoStartBreaks: false });
    const { state } = completePhase(
      start(createInitialState(config), T0),
      config,
      T0 + 25 * MINUTE,
    );

    expect(state.status).toBe('idle');
    expect(state.endsAt).toBeNull();
    expect(state.remaining).toBe(5 * MINUTE);
  });

  it('auto-starts a focus session when configured to', () => {
    const config = makeConfig({ autoStartWork: true });
    const breakState: TimerState = {
      ...createInitialState(config),
      phase: 'shortBreak',
      remaining: 5 * MINUTE,
    };

    const { state } = completePhase(start(breakState, T0), config, T0 + 5 * MINUTE);

    expect(state.phase).toBe('work');
    expect(state.status).toBe('running');
  });
});

describe('phaseCompletion', () => {
  it('records the full duration of an uninterrupted phase', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const completion = phaseCompletion(state, config, T0 + 25 * MINUTE);

    expect(completion.phase).toBe('work');
    expect(completion.durationMs).toBe(25 * MINUTE);
    expect(completion.endedAt).toBe(T0 + 25 * MINUTE);
  });

  it('records the full duration across a pause and resume', () => {
    const config = makeConfig();
    const running = start(createInitialState(config), T0);

    // Ten minutes in, the user pauses for an hour.
    const paused = pause(running, T0 + 10 * MINUTE);
    expect(paused.elapsedMs).toBe(10 * MINUTE);
    expect(paused.remaining).toBe(15 * MINUTE);

    // An hour later the user resumes and runs the phase to its deadline.
    const resumed = start(paused, T0 + 70 * MINUTE);
    expect(resumed.endsAt).toBe(T0 + 70 * MINUTE + 15 * MINUTE);

    const completion = phaseCompletion(resumed, config, T0 + 85 * MINUTE);

    // The phase still occupied its full 25 minutes of focus time, even
    // though the wall-clock span was over an hour.
    expect(completion.durationMs).toBe(25 * MINUTE);
  });

  it('records the interruptions of the phase', () => {
    const config = makeConfig();
    const state = recordInterruption(recordInterruption(start(createInitialState(config), T0)));

    const completion = phaseCompletion(state, config, T0 + 25 * MINUTE);

    expect(completion.interruptions).toBe(2);
  });

  it('never reports more than the configured duration', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    // A deadline that is somehow far in the future must not inflate the
    // recorded time beyond the phase's configured length.
    const completion = phaseCompletion(state, config, T0 + 10 * 60 * MINUTE);

    expect(completion.durationMs).toBe(25 * MINUTE);
  });
});

describe('elapsed time banking', () => {
  it('banks nothing while the timer has not started', () => {
    const state = createInitialState(makeConfig());

    expect(state.elapsedMs).toBe(0);
  });

  it('banks the time served before a pause', () => {
    const config = makeConfig();
    const running = start(createInitialState(config), T0);

    const paused = pause(running, T0 + 10 * MINUTE);

    expect(paused.elapsedMs).toBe(10 * MINUTE);
  });

  it('accumulates the banked time across several pauses', () => {
    const config = makeConfig();
    let state = start(createInitialState(config), T0);

    state = pause(state, T0 + 10 * MINUTE);
    state = start(state, T0 + 20 * MINUTE);
    state = pause(state, T0 + 25 * MINUTE);

    expect(state.elapsedMs).toBe(15 * MINUTE);
    expect(state.remaining).toBe(10 * MINUTE);
  });

  it('clears the banked time when the phase is reset', () => {
    const config = makeConfig();
    const paused = pause(start(createInitialState(config), T0), T0 + 10 * MINUTE);

    const reset = resetPhase(paused, config);

    expect(reset.elapsedMs).toBe(0);
    expect(reset.remaining).toBe(25 * MINUTE);
  });
});

describe('resetPhase', () => {
  it('restores the full duration and clears the deadline', () => {
    const running = start(createInitialState(makeConfig()), T0);
    const reset = resetPhase(running, makeConfig());

    expect(reset.status).toBe('idle');
    expect(reset.endsAt).toBeNull();
    expect(reset.remaining).toBe(25 * MINUTE);
  });
});

describe('resetSession', () => {
  it('clears the cycle progress but keeps the lifetime counters', () => {
    let state = createInitialState(makeConfig());
    state = advance(state, makeConfig());
    state = recordInterruption(state);

    const reset = resetSession(state, makeConfig());

    expect(reset.phase).toBe('work');
    expect(reset.completedWorkSessions).toBe(0);
    expect(reset.totalWorkSessions).toBe(1);
    expect(reset.totalInterruptions).toBe(1);
  });
});

describe('skipPhase', () => {
  it('moves to the next phase without counting the focus session', () => {
    const skipped = skipPhase(createInitialState(makeConfig()), makeConfig());

    expect(skipped.phase).toBe('shortBreak');
    expect(skipped.totalWorkSessions).toBe(0);
    expect(skipped.completedWorkSessions).toBe(0);
    expect(skipped.status).toBe('idle');
  });

  it('does not let a skipped session earn a long break', () => {
    const config = makeConfig();
    // Complete three focus sessions normally, leaving the fourth in progress.
    const state = completeFocusSessions(createInitialState(config), config, 3);
    const inProgress = advance(state, config);

    expect(inProgress.phase).toBe('work');
    expect(inProgress.completedWorkSessions).toBe(3);

    const skipped = skipPhase(inProgress, config);

    // The skipped session is void, so the break that follows is short.
    expect(skipped.phase).toBe('shortBreak');
    expect(skipped.completedWorkSessions).toBe(3);
  });
});

describe('recordInterruption', () => {
  it('tracks both the phase and the session totals', () => {
    const once = recordInterruption(createInitialState(makeConfig()));
    const twice = recordInterruption(once);

    expect(twice.interruptions).toBe(2);
    expect(twice.totalInterruptions).toBe(2);
  });

  it('resets the per-phase counter when a phase completes', () => {
    const interrupted = recordInterruption(createInitialState(makeConfig()));
    const advanced = advance(interrupted, makeConfig());

    expect(advanced.interruptions).toBe(0);
    expect(advanced.totalInterruptions).toBe(1);
  });
});

describe('cycleProgress', () => {
  it('counts the focus sessions completed in the current set', () => {
    const config = makeConfig();
    let state = createInitialState(config);

    expect(cycleProgress(state, config)).toEqual({ completed: 0, total: 4 });

    // Finishing the first focus session moves to a short break.
    state = advance(state, config);
    expect(state.phase).toBe('shortBreak');
    expect(cycleProgress(state, config)).toEqual({ completed: 1, total: 4 });

    // Leaving the break starts the second focus session.
    state = advance(state, config);
    expect(state.phase).toBe('work');
    expect(cycleProgress(state, config)).toEqual({ completed: 1, total: 4 });
  });

  it('wraps back to zero once a long break has been taken', () => {
    const config = makeConfig();
    const state = completeFocusSessions(createInitialState(config), config, 4);

    // The fourth focus session is followed by a long break.
    expect(state.phase).toBe('longBreak');
    expect(cycleProgress(state, config)).toEqual({ completed: 0, total: 4 });
  });
});

describe('isLongBreakDue', () => {
  it('is due exactly on a multiple of the interval', () => {
    const config = makeConfig();

    expect(isLongBreakDue(4, config)).toBe(true);
    expect(isLongBreakDue(8, config)).toBe(true);
    expect(isLongBreakDue(3, config)).toBe(false);
    expect(isLongBreakDue(0, config)).toBe(false);
  });
});

describe('durationForPhase', () => {
  it('maps each phase to its configured duration', () => {
    const config = makeConfig();

    expect(durationForPhase('work', config)).toBe(25 * MINUTE);
    expect(durationForPhase('shortBreak', config)).toBe(5 * MINUTE);
    expect(durationForPhase('longBreak', config)).toBe(15 * MINUTE);
  });
});

describe('labels', () => {
  it('produces human-readable labels', () => {
    expect(phaseLabel('work')).toBe('Focus');
    expect(phaseLabel('shortBreak')).toBe('Short break');
    expect(phaseLabel('longBreak')).toBe('Long break');
    expect(statusLabel('idle')).toBe('Ready');
    expect(statusLabel('running')).toBe('Running');
    expect(statusLabel('paused')).toBe('Paused');
  });
});

describe('presets', () => {
  it('builds a config from a preset in milliseconds', () => {
    const config = configFromPreset(defaultPreset());

    expect(config.workMs).toBe(25 * MINUTE);
    expect(config.shortBreakMs).toBe(5 * MINUTE);
    expect(config.longBreakMs).toBe(15 * MINUTE);
  });

  it('exposes every preset with a summary', () => {
    for (const preset of TIMER_PRESETS) {
      expect(preset.summary).toMatch(/^\d+ \/ \d+ \/ \d+$/);
    }
  });
});
