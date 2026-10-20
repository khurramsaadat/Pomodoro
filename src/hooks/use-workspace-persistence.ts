import { useEffect, useRef } from 'react';

import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';
import { historyRepository } from '@/storage/history';
import { preferencesRepository } from '@/storage/preferences';
import { tasksRepository } from '@/storage/tasks';

/**
 * Restores and persists the workspace: the task queue, the session history
 * and the user preferences.
 *
 * The three are persisted separately so that a failure in one — a full
 * quota, say — cannot take the others down with it.
 *
 * The stores are *subscribed* to rather than watched through render state.
 * A render-driven effect would write the value captured during the render
 * that preceded the restore, which would overwrite the stored data with the
 * empty initial state. A subscription always sees the current state, and it
 * only fires on a real transition — never on each tick — so the writes stay
 * cheap.
 *
 * This hook must run before `useTimerPersistence`, because the timer's
 * catch-up records the phases that elapsed while the app was closed into
 * the history, and the history has to be restored before that happens.
 */
export function useWorkspacePersistence(): void {
  // The restore only runs once, but the subscription is set up on every
  // mount of the effect. React's StrictMode mounts, unmounts and remounts
  // an effect in development, so a single guard around the whole effect
  // would leave the app with no subscription — and therefore no persistence.
  const restoredRef = useRef(false);

  useEffect(() => {
    // Subscribe before restoring, so that the restored state is persisted
    // as it is rather than being left as whatever was stored before.
    const unsubscribeTasks = useTaskStore.subscribe((state) => {
      tasksRepository.write({ tasks: state.tasks, activeTaskId: state.activeTaskId });
    });

    const unsubscribeHistory = useHistoryStore.subscribe((state) => {
      historyRepository.write(state.entries);
    });

    const unsubscribePreferences = usePreferencesStore.subscribe((state) => {
      preferencesRepository.write(state.preferences);
    });

    if (!restoredRef.current) {
      restoredRef.current = true;

      useTaskStore.getState().restore();
      useHistoryStore.getState().restore();
      usePreferencesStore.getState().restore();

      // The restored state is written back explicitly. A subscription only
      // fires on a change, so a payload that was discarded as invalid — or a
      // store that was already at its default — would otherwise leave the
      // stale value in storage.
      const taskState = useTaskStore.getState();
      tasksRepository.write({ tasks: taskState.tasks, activeTaskId: taskState.activeTaskId });
      historyRepository.write(useHistoryStore.getState().entries);
      preferencesRepository.write(usePreferencesStore.getState().preferences);
    }

    return () => {
      unsubscribeTasks();
      unsubscribeHistory();
      unsubscribePreferences();
    };
  }, []);
}
