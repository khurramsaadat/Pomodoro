import { Timer } from 'lucide-react';
import type * as React from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';

export interface AppShellProps {
  children: React.ReactNode;
  /** Rendered on the right of the header, before the theme toggle. */
  actions?: React.ReactNode;
}

/**
 * The application chrome: a sticky header plus a centred, width-capped
 * content column. Layout is responsive from a 320px phone up to a wide desktop.
 */
export function AppShell({ children, actions }: AppShellProps) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <Timer className="size-4.5" />
            </span>
            <span className="text-foreground text-base font-semibold tracking-tight">Pomodoro</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      {/*
        A single line, so the footer never competes with the dashboard for
        vertical space. It wraps rather than truncating on a narrow screen.
      */}
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-3 text-xs sm:px-6">
          <span>© 2006 Khurram</span>
          <span aria-hidden="true">·</span>
          <span>Focus deliberately. Break fully.</span>
          <span aria-hidden="true">·</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
            <a href="https://v2.tauri.app/" target="_blank" rel="noreferrer noopener">
              Tauri v2
            </a>
          </Button>
        </div>
      </footer>
    </div>
  );
}
