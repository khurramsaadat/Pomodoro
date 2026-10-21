import type * as React from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
  /** Rendered on the right of the header, before the theme toggle. */
  actions?: React.ReactNode;
  /**
   * The navigation bar, pinned to the bottom of the window.
   *
   * It is passed in rather than drawn here, because the bar is a *tab list*
   * and the tab list has to live inside the tab root to know which tab is
   * selected. The tab root is above the shell, so the bar is handed down
   * to be placed here.
   */
  nav?: React.ReactNode;
  /**
   * Whether the chrome is hidden.
   *
   * The web tier's mini timer is drawn inside the page, so the header and
   * the footer have to go: a widget floating over a full application shell
   * looks like a mistake, because the shell is still there. The native
   * tier shrinks its own *window*, so the shell is already gone by the
   * time the page redraws and this flag stays false.
   */
  readonly bare?: boolean;
}

/**
 * The application chrome: a header, a scrolling content column, and a
 * navigation bar pinned to the bottom of the window.
 *
 * The shell is a fixed-height flex column rather than a growing page. That
 * is what makes the navigation bar possible: the bar is *outside* the
 * scrolling area, so it stays where the user put it however far the
 * content scrolls, and the content scrolls under it rather than pushing
 * it away.
 */
export function AppShell({ children, actions, nav, bare = false }: AppShellProps) {
  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      <header
        className={cn(
          'bg-background/80 z-40 shrink-0 border-b backdrop-blur-md',
          bare && 'hidden',
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          {/*
            The brand is the app's own mark rather than a generic clock
            glyph, so the window, the favicon and the installed desktop
            icon are all recognisably the same thing.
          */}
          <div className="flex items-center gap-2.5">
            <img
              src="/app-icon.svg"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md"
            />
            <span className="text-foreground text-base font-semibold tracking-tight">Pomodoro</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/*
        The scroll container is the full width of the window, and the width
        cap is an inner element, so the scrollbar sits against the edge of
        the window rather than against the edge of the content.

        The copyright sits at the *end* of the scrollable content rather
        than in a strip of its own: the bottom of the window belongs to the
        navigation bar, and a second fixed strip above it would take the
        space the bar was meant to give back.
      */}
      <main
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          bare && 'flex overflow-hidden',
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-7xl',
            bare ? 'flex-1 p-0' : 'px-4 py-6 sm:px-6 sm:py-8',
          )}
        >
          {children}
        </div>

        {/*
          A single line, so the footer never competes with the dashboard for
          vertical space. It wraps rather than truncating on a narrow
          screen. The role is stated explicitly because the element is no
          longer a direct child of the body, and a `contentinfo` landmark
          has to stay at the top level to mean what it says.
        */}
        <footer
          role="contentinfo"
          className={cn('border-t', bare && 'hidden')}
        >
          <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-3 text-xs sm:px-6">
            <span>© 2006 Pomodoro by Khurram</span>
          </div>
        </footer>
      </main>

      {/*
        The navigation bar is the last thing in the window, the way a
        phone's navigation bar is: the destinations are always within
        reach of the thumb, whatever the content is doing.
      */}
      {nav ? (
        <nav
          className={cn('bg-background/95 shrink-0 border-t backdrop-blur-md', bare && 'hidden')}
          data-testid="app-nav"
        >
          {nav}
        </nav>
      ) : null}
    </div>
  );
}
