import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * The little interactions announce themselves: a finished task and a daily
 * goal that has just been crossed both say so, and a goal that was already
 * met before the app opened says nothing at all.
 */

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

/** The goal is one session, so a single recorded session crosses it. */
function resetStores(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
  useTaskStore.setState({ tasks: [], activeTaskId: null });
  useHistoryStore.setState({ entries: [] });
  usePreferencesStore.setState({
    preferences: {
      dailyGoal: 1,
      dailyGoalMode: 'sessions',
      dailyGoalMinutes: 120,
      autoAdvanceTask: true,
      soundEnabled: true,
      completionSound: 'chime',
      confirmBeforeClearing: true,
      showCompletedTasks: true,
      alwaysOnTop: false,
      backgroundSound: 'none',
      backgroundVolume: 0.4,
      ambienceScope: 'both',
      alwaysOnTopFollowsPhase: false,
      notificationsEnabled: true,
      attentionEnabled: true,
    },
  });
}

/** Records a completed focus session the way the engine would. */
function recordFocusSession(): void {
  const endedAt = Date.now();
  act(() => {
    useHistoryStore.getState().record(
      {
        phase: 'work',
        startedAt: endedAt - 25 * 60_000,
        endedAt,
        durationMs: 25 * 60_000,
        interruptions: 0,
        voided: false,
      },
      null,
    );
  });
}

describe('The daily goal announcement', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('says nothing when the app opens on a goal that is already met', async () => {
    recordFocusSession();
    renderApp();

    // The toast library renders on a tick, so absence has to be given a
    // chance to fail before it can be believed.
    await waitFor(
      () => {
        expect(screen.queryByText('Daily goal reached')).not.toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });

  it('announces the goal the moment it is crossed', async () => {
    renderApp();
    expect(screen.queryByText('Daily goal reached')).not.toBeInTheDocument();

    recordFocusSession();

    expect(await screen.findByText('Daily goal reached')).toBeInTheDocument();
    expect(screen.getByText('1 focus session today.')).toBeInTheDocument();
  });
});

describe('Finishing a task', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('says which task it was', async () => {
    act(() => {
      useTaskStore.getState().addTask('Write the report', 3);
    });
    renderApp();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mark Write the report as done' }));

    const announcement = await screen.findByText('Task done');
    expect(announcement).toBeInTheDocument();

    // The title is also on the row itself, so the claim is checked inside
    // the toast rather than anywhere on the page.
    const toast = announcement.closest<HTMLElement>('[data-sonner-toast]');
    if (toast === null) {
      throw new Error('the task-done toast did not render');
    }
    expect(toast).toHaveTextContent('Write the report');
  });
});
