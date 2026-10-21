import { render, screen, within } from '@testing-library/react';
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

  it('shows the session settings in the workspace column', async () => {
    const user = userEvent.setup();
    renderApp();

    const workspace = screen.getByTestId('dashboard-workspace');

    await user.click(screen.getByRole('tab', { name: /session/i }));

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

    expect(footer).toHaveTextContent('© 2006 Pomodoro by Khurram');
    // One line: the footer holds a single row of content.
    expect(footer.querySelectorAll('p, h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });
});

describe('The navigation bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    resetTimerStore();
  });

  it('holds the four workspaces', () => {
    renderApp();

    const nav = screen.getByTestId('app-nav');

    expect(within(nav).getByRole('tab', { name: /session/i })).toBeInTheDocument();
    expect(within(nav).getByRole('tab', { name: /tasks/i })).toBeInTheDocument();
    expect(within(nav).getByRole('tab', { name: /stats/i })).toBeInTheDocument();
    expect(within(nav).getByRole('tab', { name: /settings/i })).toBeInTheDocument();
  });

  it('offers the queue before the session', () => {
    renderApp();

    const nav = screen.getByTestId('app-nav');

    // The queue is the question the user asks most often, so it comes
    // first. "Before" is a fact about the document order.
    const tasks = within(nav).getByRole('tab', { name: /tasks/i });
    const session = within(nav).getByRole('tab', { name: /session/i });

    expect(
      tasks.compareDocumentPosition(session) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('opens on the queue', () => {
    renderApp();

    // The landing workspace is the one that decides what the session is
    // for.
    expect(screen.getByRole('tab', { name: /tasks/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('is at the bottom of the window, below the content', () => {
    renderApp();

    const nav = screen.getByTestId('app-nav');
    const main = screen.getByRole('main');

    // The bar is pinned to the bottom: it comes *after* the scrolling
    // area in the document, so the content scrolls under it rather than
    // pushing it away.
    expect(
      main.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('switches the workspace from the bar', async () => {
    const user = userEvent.setup();
    renderApp();

    const nav = screen.getByTestId('app-nav');
    const workspace = screen.getByTestId('dashboard-workspace');

    await user.click(within(nav).getByRole('tab', { name: /stats/i }));

    expect(workspace).toHaveTextContent('Statistics');
  });

  it('keeps the clock on screen when the bar switches the workspace', async () => {
    const user = userEvent.setup();
    renderApp();

    const nav = screen.getByTestId('app-nav');

    await user.click(within(nav).getByRole('tab', { name: /tasks/i }));

    // The clock column is outside the tab boundary, so the countdown is
    // never unmounted by switching workspaces.
    expect(screen.getByTestId('timer-countdown')).toBeInTheDocument();
  });
});
