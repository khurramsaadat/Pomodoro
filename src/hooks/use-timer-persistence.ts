import { useEffect, useRef } from 'react';

import { catchUp } from '@/domain/catch-up';
import type { TimerPhase } from '@/domain/types';
import { readPersistedTimer, writePersistedTimer } from '@/lib/storage';
import { useHistoryStore } from '@/store/history-store';
import { selectActiveTask, useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * Restores the timer on startup and keeps it persisted.
 *
 * On mount the persisted snapshot is read and replayed: any phase that
 * expired while the tab was closed is caught up, so the user returns to a
 * timer that reflects the real elapsed time rather than a stale one.
 *
 * After that the snapshot is written on every state change. The store only
 * changes on real transitions — never on each tick — so the write is not
 * hot, and writing synchronously means the final state is never lost when
 * the tab closes.
 *
 * The store is *subscribed* to rather than watched through render state. A
 * render-driven effect would write the value captured during the render
 * that preceded the restore, overwriting the stored snapshot with the
 * initial state.
 */

export interface UseTimerPersistenceOptions {
  /** Called with the phases that completed while the app was closed. */
  readonly onRestored?: ((completedPhases: readonly TimerPhase[]) => void) | undefined;
}

export function useTimerPersistence(options: UseTimerPersistenceOptions = {}): void {
  const { onRestored } = options;
  const onRestoredRef = useRef(onRestored);
  useEffect(() => {
    onRestoredRef.current = onRestored;
  }, [onRestored]);

  // Restore once, on mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    // Subscribe *before* restoring. The subscription is what persists the
    // caught-up state, so it has to be in place when the restore happens —
    // otherwise the stored snapshot would keep pointing at the expired
    // phase and the catch-up would run again on the next load, recording
    // the same session twice.
    //
    // The subscription is set up on *every* mount of this effect, while the
    // restore only runs once. React's StrictMode mounts, unmounts and
    // remounts an effect in development, so a guard that returned early
    // would leave the app with no subscription at all — and therefore no
    // persistence.
    const unsubscribe = useTimerStore.subscribe((store) => {
      writePersistedTimer(store.state, store.config);
    });

    if (restoredRef.current) {
      return unsubscribe;
    }
    restoredRef.current = true;

    const persisted = readPersistedTimer();
    if (!persisted) {
      // Nothing was stored, so the current state is written as the baseline.
      const store = useTimerStore.getState();
      writePersistedTimer(store.state, store.config);
      return unsubscribe;
    }

    const { state: caughtUpState, completedPhases, completions } = catchUp(
      persisted.state,
      persisted.config,
      Date.now(),
    );

    useTimerStore.getState().restore(caughtUpState, persisted.config);

    // The phases that ran while the app was closed were real work, so they
    // are recorded in the history and credited to the active task.
    if (completions.length > 0) {
      const activeTask = selectActiveTask(useTaskStore.getState());
      const history = useHistoryStore.getState();

      for (const completion of completions) {
        history.record(completion, activeTask);
        if (completion.phase === 'work') {
          useTaskStore.getState().recordFocusSession();
        }
      }
    }

    if (completedPhases.length > 0) {
      onRestoredRef.current?.(completedPhases);
    }

    return unsubscribe;
  }, []);
}
