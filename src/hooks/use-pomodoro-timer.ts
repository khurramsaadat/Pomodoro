import { useCallback, useEffect, useRef, useState } from 'react';

import { playCompletionCue } from '@/lib/audio';
import type { TimerPhase } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTimerStore } from '@/store/timer-store';

/** How often the countdown is re-rendered, in milliseconds. */
const TICK_INTERVAL_MS = 200;

export interface UsePomodoroTimerOptions {
  /** Called when a phase reaches its deadline. */
  readonly onPhaseComplete?: ((phase: TimerPhase) => void) | undefined;
}

export interface UsePomodoroTimerResult {
  /** Milliseconds left in the current phase. */
  readonly remaining: number;
  /** Starts or resumes the timer. */
  readonly start: () => void;
  /** Pauses the timer. */
  readonly pause: () => void;
  /** Toggles between running and paused. */
  readonly toggle: () => void;
  /** Resets the current phase. */
  readonly reset: () => void;
  /** Skips to the next phase. */
  readonly skip: () => void;
  /** Records an interruption. */
  readonly interrupt: () => void;
}

/**
 * Drives the timer from an absolute deadline.
 *
 * The hook never decrements a counter. It asks the store how much time is
 * left (`endsAt - Date.now()`), which means a backgrounded or throttled tab
 * cannot make the countdown drift — the moment the tab regains focus the
 * remaining time is re-derived and is exactly correct.
 *
 * Completion is detected in two places:
 *  - on the tick, for the common case; and
 *  - on `visibilitychange`/`focus`, which catches a tab that was throttled
 *    hard enough that the tick never fired.
 */
export function usePomodoroTimer(
  options: UsePomodoroTimerOptions = {},
): UsePomodoroTimerResult {
  const state = useTimerStore((store) => store.state);
  const storeStart = useTimerStore((store) => store.start);
  const storePause = useTimerStore((store) => store.pause);
  const storeToggle = useTimerStore((store) => store.toggle);
  const storeReset = useTimerStore((store) => store.reset);
  const storeSkip = useTimerStore((store) => store.skip);
  const storeInterrupt = useTimerStore((store) => store.interrupt);
  const storeComplete = useTimerStore((store) => store.complete);
  const soundEnabled = usePreferencesStore((store) => store.preferences.soundEnabled);
  const completionSound = usePreferencesStore((store) => store.preferences.completionSound);

  const { onPhaseComplete } = options;

  /**
   * The timestamp the countdown is measured against.
   *
   * The remaining time is *derived* from the store's deadline and this
   * timestamp rather than being mirrored into state, so it can never drift
   * out of sync with the store. The timestamp is refreshed on every tick.
   */
  const [now, setNow] = useState(() => Date.now());

  // Kept in a ref so the tick effect does not need to be torn down and
  // rebuilt every time the callback identity changes.
  const onPhaseCompleteRef = useRef(onPhaseComplete);
  useEffect(() => {
    onPhaseCompleteRef.current = onPhaseComplete;
  }, [onPhaseComplete]);

  // Guards against completing the same phase twice in a row.
  const completingRef = useRef(false);

  const checkExpiry = useCallback(() => {
    const current = useTimerStore.getState();
    if (current.state.status !== 'running' || current.state.endsAt === null) {
      return;
    }

    if (Date.now() < current.state.endsAt) {
      return;
    }

    if (completingRef.current) {
      return;
    }
    completingRef.current = true;

    const completedPhase = current.state.phase;

    // The deadline that was reached. It is read *before* the store is
    // updated, because the update replaces the state that holds it — and
    // the deadline is what identifies this phase end, both to the
    // de-duplication in `playCompletionCue` and to the host's alarm.
    const endsAt = current.state.endsAt;

    storeComplete();

    // The chime is a preference, not a fact about the timer: a user who has
    // turned the sound off should not hear it, even though the phase still
    // completes.
    if (soundEnabled) {
      playCompletionCue({
        phase: completedPhase,
        endsAt,
        sound: completionSound,
      });
    }

    onPhaseCompleteRef.current?.(completedPhase);

    // Release the guard on the next tick so the following phase can complete.
    window.setTimeout(() => {
      completingRef.current = false;
    }, 0);
  }, [storeComplete, soundEnabled, completionSound]);

  // Keep the derived timestamp fresh while the timer runs.
  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }

    const tick = (): void => {
      setNow(Date.now());
      checkExpiry();
    };

    tick();

    const interval = window.setInterval(tick, TICK_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [state.status, checkExpiry]);

  // Catch up after the tab has been hidden or the window regained focus.
  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }

    const onVisible = (): void => {
      setNow(Date.now());
      checkExpiry();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [state.status, checkExpiry]);

  // The remaining time is derived, never mirrored: a paused or idle timer
  // reports the frozen value the store holds, and a running timer reports
  // the distance to its deadline.
  const remaining =
    state.status === 'running' && state.endsAt !== null
      ? Math.max(0, state.endsAt - now)
      : state.remaining;

  // Starting or resuming re-bases the deadline on the current time, so the
  // derived timestamp has to move with it.
  const start = useCallback(() => {
    setNow(Date.now());
    storeStart();
  }, [storeStart]);

  const toggle = useCallback(() => {
    setNow(Date.now());
    storeToggle();
  }, [storeToggle]);

  return {
    remaining,
    start,
    pause: storePause,
    toggle,
    reset: storeReset,
    skip: storeSkip,
    interrupt: storeInterrupt,
  };
}
