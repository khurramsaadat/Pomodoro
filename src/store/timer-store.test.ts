import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { useTimerStore } from '@/store/timer-store';

describe('timer store', () => {
  beforeEach(() => {
    useTimerStore.setState({
      state: createInitialState(defaultConfig()),
      config: defaultConfig(),
    });
    vi.useRealTimers();
  });

  it('starts idle with the full focus duration', () => {
    const { state } = useTimerStore.getState();

    expect(state.status).toBe('idle');
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(25 * 60_000);
  });

  it('starts the timer with an absolute deadline', () => {
    useTimerStore.getState().start();
    const { state } = useTimerStore.getState();

    expect(state.status).toBe('running');
    expect(state.endsAt).not.toBeNull();
    expect(state.endsAt).toBeGreaterThan(Date.now());
  });

  it('pauses and resumes without losing time', () => {
    const store = useTimerStore.getState();

    store.start();
    store.pause();
    const paused = useTimerStore.getState().state;

    expect(paused.status).toBe('paused');
    expect(paused.endsAt).toBeNull();
    expect(paused.remaining).toBeLessThanOrEqual(25 * 60_000);

    store.start();
    const resumed = useTimerStore.getState().state;

    expect(resumed.status).toBe('running');
    expect(resumed.endsAt).not.toBeNull();
  });

  it('toggles between running and paused', () => {
    const store = useTimerStore.getState();

    store.toggle();
    expect(useTimerStore.getState().state.status).toBe('running');

    store.toggle();
    expect(useTimerStore.getState().state.status).toBe('paused');
  });

  it('skips to the next phase', () => {
    useTimerStore.getState().skip();
    const { state } = useTimerStore.getState();

    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('idle');
    expect(state.remaining).toBe(5 * 60_000);
  });

  it('resets the current phase back to its full duration', () => {
    const store = useTimerStore.getState();

    store.start();
    store.reset();
    const { state } = useTimerStore.getState();

    expect(state.status).toBe('idle');
    expect(state.remaining).toBe(25 * 60_000);
  });

  it('records interruptions', () => {
    const store = useTimerStore.getState();

    store.interrupt();
    store.interrupt();

    const { state } = useTimerStore.getState();
    expect(state.interruptions).toBe(2);
    expect(state.totalInterruptions).toBe(2);
  });

  it('re-bases the remaining time when the configuration changes', () => {
    const store = useTimerStore.getState();

    store.setConfig({ ...defaultConfig(), workMs: 50 * 60_000 });

    const { state, config } = useTimerStore.getState();
    expect(config.workMs).toBe(50 * 60_000);
    expect(state.remaining).toBe(50 * 60_000);
  });

  it('does not rewind a running timer when the configuration changes', () => {
    const store = useTimerStore.getState();

    store.start();
    const before = useTimerStore.getState().state.remaining;
    // The deadline is in the future, so elapsed time is preserved.
    store.setConfig({ ...defaultConfig(), workMs: 50 * 60_000 });

    const after = useTimerStore.getState().state.remaining;
    expect(after).toBeLessThan(50 * 60_000);
    expect(after).toBeLessThanOrEqual(before + 1000);
  });
});
