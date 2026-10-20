import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { useTimerStore } from '@/store/timer-store';

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

function resetTimerStore(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
}

/**
 * These tests cover the dashboard layout: the clock is permanent on the left
 * and the rest of the workspace lives on the right.
 */
describe('Dashboard layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('puts the clock in its own column, separate from the workspace', () => {
    renderApp();

    const clock = screen.getByTestId('dashboard-clock');
    const workspace = screen.getByTestId('dashboard-workspace');

    expect(clock).toBeInTheDocument();
    expect(workspace).toBeInTheDocument();
    expect(clock).not.toContainElement(workspace);
    expect(workspace).not.toContainElement(clock);
  });

  it('keeps the clock on screen when the workspace tab changes', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    // The clock column is outside the tab boundary, so the countdown is
    // never unmounted by switching tabs.
    expect(screen.getByTestId('timer-countdown')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-clock')).toBeInTheDocument();
  });

  it('shows the session settings in the workspace column', () => {
    renderApp();

    const workspace = screen.getByTestId('dashboard-workspace');

    expect(workspace).toHaveTextContent('Session settings');
  });

  it('switches the workspace between the tabs', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = screen.getByTestId('dashboard-workspace');

    await user.click(screen.getByRole('tab', { name: /stats/i }));
    expect(workspace).toHaveTextContent('Statistics');

    await user.click(screen.getByRole('tab', { name: /settings/i }));
    expect(workspace).toHaveTextContent('Preferences');

    await user.click(screen.getByRole('tab', { name: /tasks/i }));
    expect(workspace).toHaveTextContent('Task queue');
  });
});

describe('Footer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('shows the copyright on a single line', () => {
    renderApp();

    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveTextContent('© 2006 Khurram');
    // One line: the footer holds a single row of content.
    expect(footer.querySelectorAll('p, h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });
});
