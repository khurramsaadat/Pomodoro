import { useCallback, useEffect, useRef } from 'react';

import { platform } from '@/platform';
import type { AlarmSignal } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTimerStore } from '@/store/timer-store';
import { formatDuration } from '@/lib/time';

/**
 * How often the tray's countdown is refreshed, in milliseconds.
 *
 * The tray tooltip shows the time left, so it has to be *ticked* rather
 * than left at whatever it was when the timer last changed state. A
 * tooltip frozen at "24:58" is a lie, and a tray that lies is worse than
 * no tray at all.
 */
const TRAY_REFRESH_MS = 1_000;

/**
 * Wires the app to the host tier.
 *
 * Three things happen here, and all three are native-only in effect:
 *
 *  - the **alarm** is scheduled against the timer's own deadline, so a
 *    phase that ends while the window is hidden still notifies on time;
 *  - the **tray** is kept in step with the timer, so its tooltip is never
 *    a lie; and
 *  - the **tray menu and the global shortcut** can start and pause the
 *    timer from outside the window.
 *
 * The hook is mounted once, inside the engine's provider, because the
 * engine is the thing that owns the deadline.
 */
export function usePlatform(): void {
  const state = useTimerStore((store) => store.state);
  const toggle = useTimerStore((store) => store.toggle);

  // The state is read through a ref so the interval that ticks the tray
  // does not have to be torn down and rebuilt on every state change.
  const stateRef = useRef(state);

  // The toggle is read through a ref for the same reason: the handler is
  // registered once, and it must call the *current* action.
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  }, [toggle]);

  /**
   * Sends the timer's current state to the tray.
   *
   * The remaining time is *derived* from the deadline, exactly as it is
   * in the countdown ring, so the tray and the window can never disagree.
   */
  const updateTray = useCallback(() => {
    const current = stateRef.current;

    const remaining =
      current.status === 'running' && current.endsAt !== null
        ? current.endsAt - Date.now()
        : current.remaining;

    platform.updateTray({
      phase: current.phase,
      remaining: formatDuration(remaining),
      running: current.status === 'running',
    });
  }, []);

  // The state is kept in a ref, and the tray is refreshed immediately, so
  // a change to the timer is reflected in the tooltip at once rather than
  // up to a second later.
  useEffect(() => {
    stateRef.current = state;
    updateTray();
  }, [state, updateTray]);

  // The tray's countdown is ticked rather than merely re-sent on change.
  useEffect(() => {
    const interval = window.setInterval(updateTray, TRAY_REFRESH_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [updateTray]);

  // Schedule the native alarm whenever the running deadline changes.
  useEffect(() => {
    if (state.status !== 'running' || state.endsAt === null) {
      platform.clearAlarm();
      return;
    }

    platform.scheduleAlarm({ endsAt: state.endsAt, phase: state.phase });
  }, [state.status, state.endsAt, state.phase]);

  // The tray menu and the global shortcut drive the timer from outside the
  // window, so they need a way in.
  useEffect(() => {
    platform.onToggleRequest(() => {
      toggleRef.current();
    });
  }, []);

  // The window is kept above the others when the user asks for it.
  //
  // The preference is the *source* of truth, and the host is told whenever
  // it changes. The initial value is sent too, because a window that is
  // only pinned after the user toggles the switch is a window that starts
  // in the wrong place.
  const alwaysOnTop = usePreferencesStore((store) => store.preferences.alwaysOnTop);

  useEffect(() => {
    if (!platform.capabilities.supportsAlwaysOnTop) {
      return;
    }
    platform.setAlwaysOnTop(alwaysOnTop);
  }, [alwaysOnTop]);
}

/**
 * Registers a handler for the native alarm.
 *
 * The alarm is the host's own timer, so it can fire even when the webview
 * is not being painted. The app uses it to keep the countdown honest.
 */
export function usePlatformAlarm(handler: (signal: AlarmSignal) => void): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    platform.onAlarm((signal) => {
      handlerRef.current(signal);
    });
  }, []);
}
