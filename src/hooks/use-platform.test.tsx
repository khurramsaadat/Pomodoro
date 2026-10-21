import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlatform } from './use-platform';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * The tray updates the platform records.
 *
 * The platform bridge is mocked rather than the native runtime, because
 * what is being tested here is the app's side of the contract: when it
 * sends an update, and what it puts in it.
 */
/**
 * The recorded calls to the platform bridge.
 *
 * They are declared with `vi.hoisted` because the `vi.mock` factory is
 * hoisted above the module's own statements, and a plain `const` would not
 * exist yet when the factory runs.
 */
const mocks = vi.hoisted(() => ({
  updateTray: vi.fn<(status: { phase: string; remaining: string; running: boolean }) => void>(),
  scheduleAlarm: vi.fn<(request: { endsAt: number; phase: string }) => void>(),
  clearAlarm: vi.fn<() => void>(),
  setAlwaysOnTop: vi.fn<(alwaysOnTop: boolean) => void>(),
}));

vi.mock('@/platform', () => ({
  platform: {
    capabilities: {
      native: false,
      supportsTray: false,
      supportsGlobalShortcut: false,
      supportsNotifications: false,
      supportsMiniWindow: false,
      supportsAlwaysOnTop: true,
    },
    scheduleAlarm: mocks.scheduleAlarm,
    clearAlarm: mocks.clearAlarm,
    updateTray: mocks.updateTray,
    setAlwaysOnTop: mocks.setAlwaysOnTop,
    onToggleRequest: vi.fn(),
    onShowRequest: vi.fn(),
    onAlarm: vi.fn(),
  },
}));

beforeEach(() => {
  mocks.updateTray.mockReset();
  mocks.scheduleAlarm.mockReset();
  mocks.clearAlarm.mockReset();
  mocks.setAlwaysOnTop.mockReset();

  useTimerStore.setState({
    state: {
      status: 'idle',
      phase: 'work',
      endsAt: null,
      remaining: 25 * 60_000,
      elapsedMs: 0,
      startedAt: null,
      completedWorkSessions: 0,
      totalWorkSessions: 0,
      completedFocusMs: 0,
      interruptions: 0,
      totalInterruptions: 0,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the platform hook', () => {
  it('sends the timer state to the tray', () => {
    render(<TestComponent />);

    expect(mocks.updateTray).toHaveBeenCalledWith({
      phase: 'work',
      remaining: '25:00',
      running: false,
    });
  });

  it('clears the alarm when the timer is not running', () => {
    render(<TestComponent />);

    expect(mocks.clearAlarm).toHaveBeenCalled();
    expect(mocks.scheduleAlarm).not.toHaveBeenCalled();
  });

  it('schedules the alarm against the deadline when the timer runs', () => {
    const endsAt = Date.now() + 60_000;

    useTimerStore.setState({
      state: {
        ...useTimerStore.getState().state,
        status: 'running',
        endsAt,
      },
    });

    render(<TestComponent />);

    expect(mocks.scheduleAlarm).toHaveBeenCalledWith({ endsAt, phase: 'work' });
  });

  it('ticks the tray so its countdown does not freeze', () => {
    vi.useFakeTimers();

    render(<TestComponent />);

    mocks.updateTray.mockClear();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    // The tooltip carries a countdown, so it has to be refreshed on a
    // timer rather than only when the timer's state changes.
    expect(mocks.updateTray.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the always-on-top preference', () => {
  beforeEach(() => {
    mocks.updateTray.mockReset();
    mocks.scheduleAlarm.mockReset();
    mocks.clearAlarm.mockReset();
    mocks.setAlwaysOnTop.mockReset();

    useTimerStore.setState({
      state: {
        status: 'idle',
        phase: 'work',
        endsAt: null,
        remaining: 25 * 60_000,
        elapsedMs: 0,
        startedAt: null,
        completedWorkSessions: 0,
        totalWorkSessions: 0,
        completedFocusMs: 0,
        interruptions: 0,
        totalInterruptions: 0,
      },
    });
  });

  it('tells the host when the window should stay on top', () => {
    render(<TestComponent />);

    // The preference is the source of truth, so the host is told about it
    // as soon as the hook mounts.
    expect(mocks.setAlwaysOnTop).toHaveBeenCalledWith(false);
  });

  it('tells the host when the preference changes', () => {
    render(<TestComponent />);
    mocks.setAlwaysOnTop.mockClear();

    act(() => {
      usePreferencesStore.getState().updatePreference('alwaysOnTop', true);
    });

    expect(mocks.setAlwaysOnTop).toHaveBeenCalledWith(true);
  });
});

/** A component that mounts the hook. */
function TestComponent() {
  usePlatform();
  return null;
}
