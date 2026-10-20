import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { HISTORY_STORAGE_KEY } from '@/storage/history';
import { TASKS_STORAGE_KEY } from '@/storage/tasks';
import { useHistoryStore } from '@/store/history-store';
import { useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

const TIMER_STORAGE_KEY = 'pomodoro-timer-state';

const MINUTE = 60_000;

/**
 * These tests cover the persistence of the workspace across reloads.
 *
 * The stores are module-level singletons, so each test resets the ones it
 * touches and the storage it reads from.
 */
function resetStores(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
  useTaskStore.setState({ tasks: [], activeTaskId: null });
  useHistoryStore.setState({ entries: [] });
}

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

/** The entries currently persisted in storage. */
function persistedHistory(): unknown[] {
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as { data?: unknown[] };
  return parsed.data ?? [];
}

/** Seeds a task queue with one active task. */
function seedTask(): void {
  const now = Date.now();
  window.localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      data: {
        tasks: [
          {
            id: 'task-1',
            title: 'Seeded task',
            estimatedPomodoros: 3,
            completedPomodoros: 0,
            done: false,
            createdAt: now,
            completedAt: null,
          },
        ],
        activeTaskId: 'task-1',
      },
    }),
  );
}

/** Seeds a running timer whose focus deadline has already passed. */
function seedExpiredTimer(): void {
  const now = Date.now();
  const config = {
    workMs: 25 * MINUTE,
    shortBreakMs: 5 * MINUTE,
    longBreakMs: 15 * MINUTE,
    longBreakInterval: 4,
    autoStartBreaks: true,
    autoStartWork: false,
  };

  window.localStorage.setItem(
    'pomodoro-timer-state',
    JSON.stringify({
      state: {
        status: 'running',
        phase: 'work',
        endsAt: now - 5 * MINUTE,
        remaining: 0,
        elapsedMs: 25 * MINUTE,
        startedAt: now - 30 * MINUTE,
        completedWorkSessions: 0,
        totalWorkSessions: 0,
        interruptions: 0,
        totalInterruptions: 0,
      },
      config,
      savedAt: now,
    }),
  );
}

describe('Workspace persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStores();
  });

  it('restores the task queue from storage', async () => {
    seedTask();

    renderApp();

    await waitFor(() => {
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });
    expect(useTaskStore.getState().tasks[0]?.title).toBe('Seeded task');
  });

  it('restores the active task selection', async () => {
    seedTask();

    renderApp();

    await waitFor(() => {
      expect(useTaskStore.getState().activeTaskId).toBe('task-1');
    });
  });

  it('records a session that completed while the app was closed', async () => {
    seedTask();
    seedExpiredTimer();

    renderApp();

    await waitFor(() => {
      expect(useHistoryStore.getState().entries.length).toBeGreaterThan(0);
    });

    // The log is newest-first, and the break that follows the focus session
    // completed after it, so the focus session is the second entry.
    const entries = useHistoryStore.getState().entries;
    const focus = entries.find((entry) => entry.phase === 'work');
    expect(focus?.durationMs).toBe(25 * MINUTE);
    expect(focus?.taskId).toBe('task-1');
  });

  it('credits a session that completed while the app was closed to the task', async () => {
    seedTask();
    seedExpiredTimer();

    renderApp();

    await waitFor(() => {
      expect(useTaskStore.getState().tasks[0]?.completedPomodoros).toBe(1);
    });
  });

  it('does not record the same session twice when reloaded', async () => {
    seedTask();
    seedExpiredTimer();

    const first = renderApp();

    await waitFor(() => {
      expect(useHistoryStore.getState().entries.length).toBeGreaterThan(0);
    });

    const countAfterFirstLoad = useHistoryStore.getState().entries.length;

    first.unmount();
    resetStores();

    // The second load must not re-run the catch-up over the same expired
    // phase, which would double-count the session.
    renderApp();

    await waitFor(() => {
      expect(useHistoryStore.getState().entries.length).toBeGreaterThan(0);
    });

    expect(useHistoryStore.getState().entries).toHaveLength(countAfterFirstLoad);
    expect(useTaskStore.getState().tasks[0]?.completedPomodoros).toBe(1);
  });

  it('persists the task queue back to storage', async () => {
    renderApp();

    await waitFor(() => {
      expect(window.localStorage.getItem(TASKS_STORAGE_KEY)).not.toBeNull();
    });
  });

  it('persists the session history to storage', async () => {
    seedExpiredTimer();

    renderApp();

    await waitFor(() => {
      expect(persistedHistory().length).toBeGreaterThan(0);
    });
  });

  it('persists a configuration change', async () => {
    renderApp();

    await waitFor(() => {
      expect(window.localStorage.getItem(TIMER_STORAGE_KEY)).not.toBeNull();
    });

    act(() => {
      useTimerStore.getState().setConfig({
        ...useTimerStore.getState().config,
        longBreakInterval: 3,
      });
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '{}') as { config?: { longBreakInterval?: number } };
      expect(parsed.config?.longBreakInterval).toBe(3);
    });
  });

  it('keeps persisting under StrictMode', async () => {
    // StrictMode mounts, unmounts and remounts an effect. The subscription
    // has to survive that, or the app silently stops persisting anything
    // in development.
    render(
      <StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(TIMER_STORAGE_KEY)).not.toBeNull();
    });

    act(() => {
      useTimerStore.getState().setConfig({
        ...useTimerStore.getState().config,
        longBreakInterval: 5,
      });
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
      const parsed = JSON.parse(raw ?? '{}') as { config?: { longBreakInterval?: number } };
      expect(parsed.config?.longBreakInterval).toBe(5);
    });
  });
});
