import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { playChime } from '@/lib/audio';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

// The audio is mocked because jsdom has no Web Audio API, and because the
// picker playing the chosen sound is exactly what these tests are about.
vi.mock('@/lib/audio', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    playChime: vi.fn(),
  };
});

/**
 * These tests cover the enhancements built on top of the working app: the
 * completed-task section, the selectable sounds, the always-on-top
 * preference, and the import/export controls.
 */

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

function resetStores(): void {
  vi.mocked(playChime).mockClear();

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

/** Adds a task and marks it as done. */
function seedCompletedTask(title: string): void {
  act(() => {
    useTaskStore.getState().addTask(title, 2);
    const task = useTaskStore.getState().tasks[0];
    if (task) {
      useTaskStore.getState().completeTask(task.id);
    }
  });
}

describe('The completed tasks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('has a section of its own', async () => {
    const user = userEvent.setup();
    seedCompletedTask('Write the report');

    renderApp();
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    // The finished work is its own section, not a tail of the queue.
    const section = screen.getByTestId('completed-tasks');
    expect(within(section).getByText('Write the report')).toBeInTheDocument();
  });

  it('is not shown when the preference is off', async () => {
    const user = userEvent.setup();
    seedCompletedTask('Write the report');

    act(() => {
      usePreferencesStore.getState().updatePreference('showCompletedTasks', false);
    });

    renderApp();
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    expect(screen.queryByTestId('completed-tasks')).not.toBeInTheDocument();
  });

  it('says so when nothing has been finished', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    // The section only appears when there is something in it.
    expect(screen.queryByTestId('completed-tasks')).not.toBeInTheDocument();
  });
});

describe('The recent sessions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('comes before the statistics', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /stats/i }));

    const recent = screen.getByText('Recent sessions');
    const statistics = screen.getByText('Statistics');

    // The log is what the statistics are derived from, and the card that
    // was below the fold is the one that has to come first.
    expect(
      recent.compareDocumentPosition(statistics) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('The sound picker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('offers every sound', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    const group = screen.getByRole('radiogroup', { name: 'Completion sound' });
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
  });

  it('records the chosen sound', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    await user.click(screen.getByRole('radio', { name: 'Bell' }));

    expect(usePreferencesStore.getState().preferences.completionSound).toBe('bell');
  });

  it('plays the sound as soon as it is chosen', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    // The preview used to be a separate button. Choosing a sound now
    // plays it, so the user hears the choice rather than reading it.
    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Bell' }));

    expect(playChime).toHaveBeenCalledWith(expect.objectContaining({ sound: 'bell' }));
  });

  it('is hidden when the sound is turned off', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    await user.click(screen.getByLabelText('Play a sound'));

    expect(screen.queryByRole('radiogroup', { name: 'Completion sound' })).not.toBeInTheDocument();
  });
});

describe('The backup controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  it('offers an export and an import', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    expect(screen.getByRole('button', { name: /export backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import backup/i })).toBeInTheDocument();
  });

  it('refuses a file that is not a backup', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: /settings/i }));

    const input = screen.getByLabelText('Choose a backup file');
    const file = new File(['not a backup'], 'backup.json', { type: 'application/json' });

    await user.upload(input, file);

    // The file is refused, and the workspace is left alone.
    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
