import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pomodoro-theme';
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeContextValue {
  /** The user's selection, which may be `system`. */
  theme: Theme;
  /** The concrete theme actually applied to the document. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

/**
 * The theme context lives outside of the provider component so that the
 * `useTheme` hook can be exported from a non-component module. This keeps
 * React Fast Refresh working (a module that exports a component should export
 * only components).
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the current theme. Throws if used outside of a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/** Reads the persisted theme selection, or null if nothing valid is stored. */
export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Storage can be unavailable in private mode or a sandboxed iframe.
  }
  return null;
}

/** The theme the operating system currently prefers. */
export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

/** Applies a resolved theme to the document root. */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}
