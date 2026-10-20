import { describe, expect, it } from 'vitest';

import { catchUp } from '@/domain/catch-up';
import { createInitialState, start } from '@/domain/timer';
import type { TimerConfig } from '@/domain/types';

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

describe('catchUp', () => {
  it('leaves a running timer alone when no phase has elapsed', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 10 * MINUTE);

    expect(result.state).toBe(state);
    expect(result.completedPhases).toEqual([]);
  });

  it('completes a single expired phase', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 26 * MINUTE);

    expect(result.completedPhases).toEqual(['work']);
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.totalWorkSessions).toBe(1);
  });

  it('replays several phases that elapsed while away', () => {
    const config = makeConfig({ autoStartWork: true });
    const state = start(createInitialState(config), T0);

    // 25 min work + 5 min short break + 25 min work = 55 minutes.
    const result = catchUp(state, config, T0 + 56 * MINUTE);

    expect(result.completedPhases).toEqual(['work', 'shortBreak', 'work']);
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.totalWorkSessions).toBe(2);
  });

  it('keeps the original schedule rather than restarting from now', () => {
    const config = makeConfig({ autoStartWork: true });
    const state = start(createInitialState(config), T0);

    // Come back just after the second focus session would have started.
    const result = catchUp(state, config, T0 + 31 * MINUTE);

    // The second focus session was scheduled to start at T0 + 30 min and to
    // run for 25 minutes, so it ends at T0 + 55 min — not 25 minutes from the
    // moment the user came back.
    expect(result.state.phase).toBe('work');
    expect(result.state.endsAt).toBe(T0 + 55 * MINUTE);
    expect(result.state.remaining).toBe(25 * MINUTE);
  });

  it('honours the long break in the reconstructed timeline', () => {
    const config = makeConfig({ autoStartWork: true });
    const state = start(createInitialState(config), T0);

    // Four focus sessions (25 min each) and three short breaks (5 min each)
    // take the schedule to T0 + 115 min, where a 15 minute long break
    // begins. Coming back at T0 + 135 min should land on the focus session
    // that the long break was followed by.
    const result = catchUp(state, config, T0 + 135 * MINUTE);

    expect(result.completedPhases).toEqual([
      'work',
      'shortBreak',
      'work',
      'shortBreak',
      'work',
      'shortBreak',
      'work',
      'longBreak',
    ]);
    expect(result.state.phase).toBe('work');
    expect(result.state.completedWorkSessions).toBe(4);
    expect(result.state.endsAt).toBe(T0 + 155 * MINUTE);
  });

  it('stops at a phase that was waiting for the user', () => {
    const config = makeConfig({ autoStartBreaks: false });
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 60 * MINUTE);

    expect(result.completedPhases).toEqual(['work']);
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.status).toBe('idle');
    expect(result.state.endsAt).toBeNull();
  });

  it('does nothing for an idle or paused timer', () => {
    const config = makeConfig();
    const idle = createInitialState(config);

    const result = catchUp(idle, config, T0 + 100 * MINUTE);

    expect(result.state).toBe(idle);
    expect(result.completedPhases).toEqual([]);
  });

  it('reaches a long break after a full set of focus sessions', () => {
    const config = makeConfig({ autoStartWork: true });
    const state = start(createInitialState(config), T0);

    // 4 focus sessions (25 min each) + 3 short breaks (5 min each) = 115 min.
    const result = catchUp(state, config, T0 + 116 * MINUTE);

    expect(result.state.phase).toBe('longBreak');
    expect(result.state.completedWorkSessions).toBe(4);
    expect(result.state.totalWorkSessions).toBe(4);
  });
});

describe('catchUp completions', () => {
  it('records the full duration of each phase that elapsed', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 26 * MINUTE);

    expect(result.completions).toHaveLength(1);
    expect(result.completions[0]?.phase).toBe('work');
    expect(result.completions[0]?.durationMs).toBe(25 * MINUTE);
    expect(result.completions[0]?.endedAt).toBe(T0 + 25 * MINUTE);
  });

  it('records the sessions that ran while the app was closed', () => {
    const config = makeConfig({ autoStartWork: true });
    const state = start(createInitialState(config), T0);

    // 25 min work + 5 min short break + 25 min work = 55 minutes.
    const result = catchUp(state, config, T0 + 56 * MINUTE);

    expect(result.completions.map((entry) => entry.phase)).toEqual([
      'work',
      'shortBreak',
      'work',
    ]);
    expect(result.completions[2]?.durationMs).toBe(25 * MINUTE);
  });

  it('uses the scheduled end times rather than the current time', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 30 * MINUTE);

    // The phase ended on its own schedule, not when the user came back.
    expect(result.completions[0]?.endedAt).toBe(T0 + 25 * MINUTE);
    expect(result.completions[0]?.startedAt).toBe(T0);
  });

  it('records nothing when no phase elapsed', () => {
    const config = makeConfig();
    const state = start(createInitialState(config), T0);

    const result = catchUp(state, config, T0 + 10 * MINUTE);

    expect(result.completions).toEqual([]);
  });
});
