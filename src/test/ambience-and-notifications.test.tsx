import { render, screen, within } from '@testing-library/react';
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
 * The settings that describe how a phase *sounds* rather than how long it
 * runs: the background ambience, the two end-of-phase notifications, and the
 * single row of data controls.
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
      autoAdvanceTask: true,
      soundEnabled: true,
      completionSound: 'chime',
      confirmBeforeClearing: true,
      showCompletedTasks: true,
      alwaysOnTop: false,
      backgroundSound: 'none',
      backgroundVolume: 0.4,
      notificationsEnabled: true,
      attentionEnabled: true,
    },
  });
}

/**
 * Opens the settings workspace.
 *
 * The container is read *before* the click: it is the persistent column the
 * tab content is drawn into, so it survives the switch and is the element
 * the new content has to appear inside.
 */
async function openSettings(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  const workspace = screen.getByTestId('dashboard-workspace');

  await user.click(screen.getByRole('tab', { name: /settings/i }));

  return workspace;
}

describe('the background ambience', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStores();
  });

  it('offers every sound in the settings', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = await openSettings(user);
    const picker = within(workspace).getByRole('radiogroup', { name: /background ambience/i });

    for (const label of ['None', 'Brown noise', 'White noise', 'Rain', 'Ocean', 'Fireplace']) {
      expect(within(picker).getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('remembers the sound the user chose', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = await openSettings(user);
    await user.click(within(workspace).getByRole('radio', { name: 'Rain' }));

    expect(usePreferencesStore.getState().preferences.backgroundSound).toBe('rain');
    expect(within(workspace).getByRole('radio', { name: 'Rain' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // The volume only means something once a sound has been chosen, so it
    // appears with the choice rather than sitting there inert.
    expect(within(workspace).getByLabelText(/ambience volume/i)).toBeInTheDocument();
  });
});

describe('the end-of-phase notifications', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStores();
  });

  it('can be turned off, one at a time', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = await openSettings(user);

    await user.click(within(workspace).getByRole('switch', { name: /notify when a phase ends/i }));
    expect(usePreferencesStore.getState().preferences.notificationsEnabled).toBe(false);

    // The taskbar flash is a separate choice: wanting one without the other
    // is the ordinary case, not a contradiction.
    expect(usePreferencesStore.getState().preferences.attentionEnabled).toBe(true);
  });
});

describe('the data controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStores();
  });

  it('sit in one row, with About beside Clear history', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = await openSettings(user);

    const exportButton = within(workspace).getByRole('button', { name: /export backup/i });
    const importButton = within(workspace).getByRole('button', { name: /import backup/i });
    const clearTasks = within(workspace).getByRole('button', { name: /clear task queue/i });
    const clearHistory = within(workspace).getByRole('button', { name: /clear history/i });
    const about = within(workspace).getByRole('button', { name: /^about$/i });

    // One row means one parent: the five controls are siblings of the same
    // flex container, rather than a backup section above a data section.
    expect(about.parentElement).toBe(clearHistory.parentElement);
    expect(clearTasks.parentElement).toBe(clearHistory.parentElement);
    expect(about.parentElement?.contains(exportButton)).toBe(true);
    expect(about.parentElement?.contains(importButton)).toBe(true);
  });

  it('say where the app keeps its data', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = await openSettings(user);
    await user.click(within(workspace).getByRole('button', { name: /^about$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Pomodoro');

    // The location comes from the platform, so it is a promise; the dialog
    // has to fill it in rather than showing "Looking…" forever.
    expect(await within(dialog).findByText(/storage for/i)).toBeInTheDocument();
  });
});
