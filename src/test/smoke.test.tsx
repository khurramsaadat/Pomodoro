import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { useTimerStore } from '@/store/timer-store';

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

/**
 * Resets the shared timer store between tests.
 *
 * The store is a module-level singleton, so without this a test that advances
 * the timer would leak its state into the next one.
 */
function resetTimerStore(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
}

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('renders the product name', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Pomodoro timer' })).toBeInTheDocument();
  });

  it('exposes the theme toggle', () => {
    renderApp();

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});

describe('Timer panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('shows the focus phase and the full duration', () => {
    renderApp();

    expect(screen.getByTestId('timer-phase')).toHaveTextContent('Focus');
    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('25:00');
  });

  it('starts and pauses the timer', async () => {
    const user = userEvent.setup();
    renderApp();

    const start = screen.getByRole('button', { name: /start timer/i });
    await user.click(start);

    expect(screen.getByRole('button', { name: /pause timer/i })).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /pause timer/i }));

    expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('skips to the next phase', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /skip to next phase/i }));

    // The phase is read from the badge rather than from the page text: the
    // session plan names the phases too, and the badge is the one that
    // says what the timer is doing *now*.
    expect(screen.getByTestId('timer-phase')).toHaveTextContent('Short break');
    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('05:00');
  });

  it('resets the current phase', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /start timer/i }));
    await user.click(screen.getByRole('button', { name: /reset current phase/i }));

    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('25:00');
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});

describe('Theme switching', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('cycles themes and persists the selection', async () => {
    const user = userEvent.setup();
    renderApp();

    const toggle = screen.getByRole('button', { name: /theme/i });

    // The default selection is `system`; the first click moves to `light`.
    await user.click(toggle);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // The second click moves to `dark` and applies the dark class.
    await user.click(toggle);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // The third click returns to `system`.
    await user.click(toggle);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('restores the persisted theme on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderApp();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
