import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { MINI_MARGIN } from '@/domain/mini-mode';
import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { MINI_MODE_STORAGE_KEY } from '@/storage/mini-mode';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * These tests cover the mini timer: that it can be opened, that it shows the
 * same countdown as the main panel, and that its layout survives a reload.
 */

function resetStores(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
  useMiniModeStore.setState({
    enabled: false,
    position: { corner: 'bottomRight', offsetX: 0, offsetY: 0 },
    hydrated: false,
  });
}

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

/** The persisted mini mode payload. */
function persistedMiniMode(): { enabled?: boolean; position?: unknown } {
  const raw = window.localStorage.getItem(MINI_MODE_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as { data?: { enabled?: boolean; position?: unknown } };
  return parsed.data ?? {};
}

describe('Mini timer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStores();
  });

  it('is hidden by default', () => {
    renderApp();

    expect(screen.queryByTestId('mini-timer')).not.toBeInTheDocument();
  });

  it('opens from the header button', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));

    expect(screen.getByTestId('mini-timer')).toBeInTheDocument();
  });

  it('shows the same countdown as the main panel', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));

    expect(screen.getByTestId('mini-countdown')).toHaveTextContent('25:00');
    expect(screen.getByTestId('timer-countdown')).toHaveTextContent('25:00');
  });

  it('can be closed again from the widget', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));
    await user.click(screen.getByRole('button', { name: /close the mini timer/i }));

    expect(screen.queryByTestId('mini-timer')).not.toBeInTheDocument();
  });

  it('persists its visibility', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));

    await waitFor(() => {
      expect(persistedMiniMode().enabled).toBe(true);
    });
  });

  it('restores its visibility from storage', async () => {
    window.localStorage.setItem(
      MINI_MODE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        data: { enabled: true, position: { corner: 'topLeft', offsetX: 0, offsetY: 0 } },
      }),
    );

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('mini-timer')).toBeInTheDocument();
    });
  });

  it('keeps counting down while the user is on another tab', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));
    await user.click(screen.getByRole('button', { name: /^start timer$/i }));

    // Switch to the tasks tab. The focus panel is unmounted, but the engine
    // lives above the tabs, so the countdown must keep running.
    await user.click(screen.getByRole('tab', { name: /tasks/i }));

    expect(screen.queryByTestId('timer-countdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('mini-countdown')).toBeInTheDocument();
    expect(screen.getByTestId('mini-countdown')).not.toHaveTextContent('25:00');
  });

  it('starts and pauses the timer from the widget', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /show the mini timer/i }));

    await user.click(screen.getByRole('button', { name: /start the mini timer/i }));

    expect(screen.getByRole('button', { name: /pause the mini timer/i })).toBeInTheDocument();
  });

  it('moves to the corner it is dropped nearest to', () => {
    renderApp();

    act(() => {
      useMiniModeStore.getState().setEnabled(true);
    });

    const widget = screen.getByTestId('mini-timer');
    const handle = screen.getByRole('button', { name: 'Drag the mini timer' });

    const drag = (to: { x: number; y: number }): void => {
      const box = widget.getBoundingClientRect();
      const startX = box.left + box.width / 2;
      const startY = box.top + box.height / 2;

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: startX, clientY: startY });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: to.x, clientY: to.y });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: to.x, clientY: to.y });
    };

    // The viewport is 1024 x 768 in jsdom, and the widget is 240 x 150.
    drag({ x: 20, y: 20 });
    expect(useMiniModeStore.getState().position.corner).toBe('topLeft');

    drag({ x: 1000, y: 740 });
    expect(useMiniModeStore.getState().position.corner).toBe('bottomRight');

    drag({ x: 20, y: 740 });
    expect(useMiniModeStore.getState().position.corner).toBe('bottomLeft');

    drag({ x: 1000, y: 20 });
    expect(useMiniModeStore.getState().position.corner).toBe('topRight');
  });

  it('records the offset from the anchor when dropped away from the corner', () => {
    renderApp();

    act(() => {
      useMiniModeStore.getState().setEnabled(true);
    });

    const widget = screen.getByTestId('mini-timer');
    const handle = screen.getByRole('button', { name: 'Drag the mini timer' });

    const box = widget.getBoundingClientRect();
    const startX = box.left + box.width / 2;
    const startY = box.top + box.height / 2;

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: startX, clientY: startY });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 30, clientY: 30 });

    const position = useMiniModeStore.getState().position;

    expect(position.corner).toBe('topLeft');
    // The top-left anchor sits at the margin, so a drop at 30px is past it.
    expect(position.offsetX).toBe(30 - MINI_MARGIN);
    expect(position.offsetY).toBe(30 - MINI_MARGIN);
  });
});
