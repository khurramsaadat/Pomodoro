import { act, render, screen, within } from '@testing-library/react';
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
 * These tests cover the improvements built on top of the correctness fixes:
 * the active task in the clock column, the daily goal bar, the preference
 * toggle, task editing, the visible history, and the keyboard shortcuts.
 */

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

function resetStores(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
  useTaskStore.setState({ tasks: [], activeTaskId: null });
  useHistoryStore.setState({ entries: [] });
  usePreferencesStore.setState({
    preferences: {
      dailyGoal: 8,
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

/** Adds a task and makes it the active one. */
function seedActiveTask(title: string, estimate: number): void {
  act(() => {
    useTaskStore.getState().addTask(title, estimate);
    const task = useTaskStore.getState().tasks[0];
    useTaskStore.getState().setActiveTask(task?.id ?? null);
  });
}

describe('The task line under the timer controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('says so when there is no active task', () => {
    renderApp();

    const clock = screen.getByTestId('dashboard-clock');
    expect(within(clock).getByText('No active task')).toBeInTheDocument();
  });

  it('names the active task in the clock, below the controls', () => {
    seedActiveTask('Write the report', 3);

    renderApp();

    const clock = screen.getByTestId('dashboard-clock');
    const workingOn = within(clock).getByTestId('working-on');

    expect(within(workingOn).getByText('Write the report')).toBeInTheDocument();

    // "Below the play button" is a fact about document order, not pixels.
    const start = within(clock).getByRole('button', { name: /start timer/i });
    expect(
      start.compareDocumentPosition(workingOn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('is no longer shown in the workspace', () => {
    seedActiveTask('Write the report', 3);

    renderApp();

    // The mention lives in the clock now; the right pane does not carry it.
    const workspace = screen.getByTestId('dashboard-workspace');
    expect(within(workspace).queryByTestId('working-on')).not.toBeInTheDocument();
  });
});

describe('The daily goal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('shows the goal and the sessions completed today', () => {
    renderApp();

    const workspace = screen.getByTestId('dashboard-workspace');
    expect(within(workspace).getByText('Daily goal')).toBeInTheDocument();
    expect(within(workspace).getByText('0 of 8 focus sessions today')).toBeInTheDocument();
  });

  it('sits below the task queue, so the work comes before the progress', () => {
    renderApp();

    const workspace = screen.getByTestId('dashboard-workspace');
    const goal = within(workspace).getByText('Daily goal');
    const queue = within(workspace).getByText('Task queue');

    // The queue is *what* the user is working on and the goal is *how far*
    // they have got, so the progress bar answers a question about the work
    // and therefore comes after it.
    expect(
      queue.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('The auto-advance preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('has a control in the preferences panel', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('tab', { name: /settings/i }));

    const toggle = screen.getByLabelText('Auto-advance the task');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(usePreferencesStore.getState().preferences.autoAdvanceTask).toBe(false);
  });
});

describe('Editing a task', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('changes the title and the estimate', async () => {
    const user = userEvent.setup();
    act(() => {
      useTaskStore.getState().addTask('Write the report', 3);
    });

    renderApp();
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    await user.click(screen.getByRole('button', { name: 'Edit Write the report' }));

    const title = screen.getByLabelText('Task title');
    await user.clear(title);
    await user.type(title, 'Write the summary');

    const estimate = screen.getByLabelText('Estimated focus sessions');
    await user.clear(estimate);
    await user.type(estimate, '5');

    await user.click(screen.getByRole('button', { name: /save/i }));

    const task = useTaskStore.getState().tasks[0];
    expect(task?.title).toBe('Write the summary');
    expect(task?.estimatedPomodoros).toBe(5);
  });

  it('leaves the task alone when the edit is cancelled', async () => {
    const user = userEvent.setup();
    act(() => {
      useTaskStore.getState().addTask('Write the report', 3);
    });

    renderApp();
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    await user.click(screen.getByRole('button', { name: 'Edit Write the report' }));

    const title = screen.getByLabelText('Task title');
    await user.clear(title);
    await user.type(title, 'Something else');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(useTaskStore.getState().tasks[0]?.title).toBe('Write the report');
  });
});

describe('The session history in the UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('says so when there is nothing recorded', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('tab', { name: /stats/i }));

    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('lists the recorded sessions', async () => {
    const user = userEvent.setup();
    act(() => {
      useHistoryStore.getState().record(
        {
          phase: 'work',
          startedAt: Date.now() - 25 * 60_000,
          endedAt: Date.now(),
          durationMs: 25 * 60_000,
          interruptions: 0,
          voided: false,
        },
        { id: 'task-1', title: 'Write the report' },
      );
    });

    renderApp();
    await user.click(screen.getByRole('tab', { name: /stats/i }));

    // The title appears in the history list and in the per-task breakdown,
    // so the list is queried directly.
    const entries = screen.getAllByTestId('history-entry');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toHaveTextContent('Write the report');
  });

  it('marks an abandoned session as abandoned', async () => {
    const user = userEvent.setup();
    act(() => {
      useHistoryStore.getState().record(
        {
          phase: 'work',
          startedAt: Date.now() - 5 * 60_000,
          endedAt: Date.now(),
          durationMs: 5 * 60_000,
          interruptions: 0,
          voided: true,
        },
        { id: 'task-1', title: 'Write the report' },
      );
    });

    renderApp();
    await user.click(screen.getByRole('tab', { name: /stats/i }));

    expect(screen.getByText('abandoned')).toBeInTheDocument();
  });
});

describe('The keyboard shortcuts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('starts the timer with the space bar', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.keyboard(' ');

    expect(screen.getByRole('button', { name: /pause timer/i })).toBeInTheDocument();
  });

  it('skips to the next phase with the right arrow', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByTestId('timer-phase')).toHaveTextContent('Short break');
  });

  it('does not fire while a text field has the focus', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('tab', { name: /tasks/i }));
    const input = screen.getByLabelText('What are you working on?');

    await user.click(input);
    await user.keyboard('{ArrowRight}');

    // The phase is unchanged: the shortcut was swallowed by the field.
    // The badge is what says which phase the timer is in — the session
    // plan names the phases too, so the page text would be ambiguous.
    expect(screen.getByTestId('timer-phase')).toHaveTextContent('Focus');
  });

  it('is discoverable through the shortcuts dialog', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /keyboard shortcuts/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Keyboard shortcuts');
    expect(dialog).toHaveTextContent('Start or pause the timer');
  });

  it('is listed in the settings panel', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('tab', { name: /settings/i }));

    // The settings tab is where a user goes to find out what the app can
    // do, so the shortcuts are listed there as well as in the dialog.
    const workspace = screen.getByTestId('dashboard-workspace');
    expect(workspace).toHaveTextContent('Keyboard shortcuts');
    expect(workspace).toHaveTextContent('Start or pause the timer');
  });
});

describe('The reset button', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('clears the counters the summary shows', async () => {
    const user = userEvent.setup();
    renderApp();

    // Record an interruption so the summary has something to show.
    act(() => {
      useTimerStore.getState().interrupt();
    });
    expect(useTimerStore.getState().state.totalInterruptions).toBe(1);

    await user.click(screen.getByRole('button', { name: /reset session/i }));

    const state = useTimerStore.getState().state;
    expect(state.totalInterruptions).toBe(0);
    expect(state.totalWorkSessions).toBe(0);
  });
});
