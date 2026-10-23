import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { APP_RELEASES_URL, APP_VERSION } from '@/domain/app-info';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { UPDATE_DISMISSED_KEY } from '@/storage/update-dismissal';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * The update strip: what it says, when it says it, and when it must be
 * quiet. Every case is driven through the real hook and the real payload
 * repair, with only the network replaced, because the whole feature is the
 * relationship between a release and the version already running.
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

/** Answers the update check with a release, the way GitHub would. */
function answerWithRelease(tag: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({
          tag_name: tag,
          html_url: `https://github.com/khurramsaadat/Pomodoro/releases/tag/${tag}`,
        }),
    }),
  );
}

describe('The update notice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('announces a release newer than the one running, with a way to get it', async () => {
    answerWithRelease('v9.9.9');

    renderApp();

    const banner = await screen.findByTestId('update-banner');
    expect(banner).toHaveTextContent('Version 9.9.9 is available.');
    expect(banner).toHaveTextContent(`You are running ${APP_VERSION}.`);

    const download = screen.getByRole('link', { name: 'Download' });
    expect(download).toHaveAttribute(
      'href',
      'https://github.com/khurramsaadat/Pomodoro/releases/tag/v9.9.9',
    );
  });

  it('is silent when the running version is already the latest', async () => {
    answerWithRelease(`v${APP_VERSION}`);

    renderApp();

    // The check is asynchronous, so silence has to be given a chance to
    // fail before it can be believed.
    await waitFor(
      () => {
        expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });

  it('is silent when the check cannot be answered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('the network is elsewhere')),
    );

    renderApp();

    await waitFor(
      () => {
        expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });

  it('announces the release it last read when the answer is refused', async () => {
    // GitHub limits unauthenticated requests to an address, so a shared
    // address will be told "no" for reasons that have nothing to do with
    // a release. The remembered answer is still true, so it is still
    // announced.
    answerWithRelease('v9.9.9');
    const first = renderApp();
    await screen.findByTestId('update-banner');
    first.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } }),
    );

    renderApp();

    expect(await screen.findByTestId('update-banner')).toHaveTextContent(
      'Version 9.9.9 is available.',
    );
  });

  it('can be dismissed, and stays dismissed for that version', async () => {
    answerWithRelease('v9.9.9');

    const view = renderApp();
    const user = userEvent.setup();

    await screen.findByTestId('update-banner');
    await user.click(screen.getByRole('button', { name: 'Dismiss the update notice' }));

    await waitFor(() => {
      expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    });

    // The dismissal outlives the page, so the same version does not come
    // back on the next start-up.
    expect(window.localStorage.getItem(UPDATE_DISMISSED_KEY)).toContain('9.9.9');

    view.unmount();
    renderApp();

    await waitFor(
      () => {
        expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });

  it('offers the download in the header on the website', () => {
    answerWithRelease(`v${APP_VERSION}`);

    renderApp();

    expect(screen.getByRole('link', { name: 'Download the desktop app' })).toHaveAttribute(
      'href',
      APP_RELEASES_URL,
    );
  });
});
