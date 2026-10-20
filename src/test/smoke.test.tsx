import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders the product name', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Pomodoro' })).toBeInTheDocument();
  });

  it('exposes the theme toggle', () => {
    renderApp();

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});

describe('Theme switching', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
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
