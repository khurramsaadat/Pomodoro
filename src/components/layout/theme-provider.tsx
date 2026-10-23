import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  applyTheme,
  DARK_MEDIA_QUERY,
  readStoredTheme,
  systemTheme,
  ThemeContext,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from '@/lib/theme';

export interface ThemeProviderProps {
  children: ReactNode;
  /** Overrides the persisted selection. Intended for tests. */
  defaultTheme?: Theme;
}

/**
 * A purpose-built theme provider.
 *
 * The application is a client-side SPA with no server rendering, so there is no
 * hydration mismatch to guard against and no need for an injected script tag
 * (which React 19 warns about). The persisted value is read synchronously on
 * mount, and the pre-paint script in index.html prevents any flash of the wrong
 * theme before React mounts.
 */
export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => defaultTheme ?? readStoredTheme() ?? 'dark');
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() => systemTheme());

  // Track OS-level changes so `system` stays live without a reload.
  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setSystemResolved(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemResolved : theme;

  // Apply to the document whenever the resolved theme changes.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort; the in-memory value still applies.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
