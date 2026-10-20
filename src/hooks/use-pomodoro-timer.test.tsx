import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePomodoroTimer } from '@/hooks/use-pomodoro-timer';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { useTimerStore } from '@/store/timer-store';

const MINUTE = 60_000;

/**
 * These tests cover the *live* catch-up: the case where the tab is still
 * open but was throttled hard enough that the tick never fired, so several
 * phases elapsed at once.
 */
function Harness({ onComplete }: { onComplete: (phase: string) => void }) {
  usePomodoroTimer({ onPhaseComplete: onComplete });
  return null;
}

describe('usePomodoroTimer live catch-up', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    useTimerStore.setState({
      state: createInitialState(defaultConfig()),
      config: defaultConfig(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes a phase that expired while the tick was throttled', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    act(() => {
      useTimerStore.getState().start();
    });

    // The tab is frozen for longer than the focus session.
    act(() => {
      vi.advanceTimersByTime(26 * MINUTE);
    });

    expect(onComplete).toHaveBeenCalledWith('work');
  });

  it('catches up on several phases that elapsed at once', () => {
    const onComplete = vi.fn();

    // Auto-start both the breaks and the focus sessions, so the schedule
    // keeps running without the user.
    useTimerStore.setState({
      config: { ...defaultConfig(), autoStartBreaks: true, autoStartWork: true },
    });

    render(<Harness onComplete={onComplete} />);

    act(() => {
      useTimerStore.getState().start();
    });

    // 25 min work + 5 min break + 25 min work = 55 minutes.
    act(() => {
      vi.advanceTimersByTime(56 * MINUTE);
    });

    expect(onComplete).toHaveBeenCalledWith('work');
    expect(onComplete).toHaveBeenCalledWith('shortBreak');
    expect(onComplete.mock.calls.filter(([phase]) => phase === 'work')).toHaveLength(2);
  });

  it('re-derives the remaining time from the deadline after a long freeze', () => {
    render(<Harness onComplete={vi.fn()} />);

    act(() => {
      useTimerStore.getState().start();
    });

    // Five minutes pass normally.
    act(() => {
      vi.advanceTimersByTime(5 * MINUTE);
    });

    expect(useTimerStore.getState().state.remaining).toBe(25 * MINUTE);

    // The phase completes and the next one starts automatically.
    act(() => {
      vi.advanceTimersByTime(21 * MINUTE);
    });

    const state = useTimerStore.getState().state;
    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('running');
    expect(state.remaining).toBe(5 * MINUTE);
  });

  it('does not complete the same phase twice', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    act(() => {
      useTimerStore.getState().start();
    });

    act(() => {
      vi.advanceTimersByTime(26 * MINUTE);
    });

    // The break is not auto-started, so the timer settles on the break.
    act(() => {
      vi.advanceTimersByTime(10 * MINUTE);
    });

    expect(onComplete.mock.calls.filter(([phase]) => phase === 'work')).toHaveLength(1);
  });
});
