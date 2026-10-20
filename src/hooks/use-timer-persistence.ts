import { useEffect, useRef } from 'react';

import { catchUp } from '@/domain/catch-up';
import type { TimerPhase } from '@/domain/types';
import { readPersistedTimer, writePersistedTimer } from '@/lib/storage';
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
 */

export interface UseTimerPersistenceOptions {
  /** Called with the phases that completed while the app was closed. */
  readonly onRestored?: ((completedPhases: readonly TimerPhase[]) => void) | undefined;
}

export function useTimerPersistence(options: UseTimerPersistenceOptions = {}): void {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);
  const restore = useTimerStore((store) => store.restore);

  const { onRestored } = options;
  const onRestoredRef = useRef(onRestored);
  useEffect(() => {
    onRestoredRef.current = onRestored;
  }, [onRestored]);

  // Restore once, on mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) {
      return;
    }
    restoredRef.current = true;

    const persisted = readPersistedTimer();
    if (!persisted) {
      return;
    }

    const { state: caughtUpState, completedPhases } = catchUp(
      persisted.state,
      persisted.config,
      Date.now(),
    );

    restore(caughtUpState, persisted.config);

    if (completedPhases.length > 0) {
      onRestoredRef.current?.(completedPhases);
    }
  }, [restore]);

  // Persist on every change.
  useEffect(() => {
    writePersistedTimer(state, config);
  }, [state, config]);
}
