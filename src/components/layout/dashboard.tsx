import type * as React from 'react';

import { cn } from '@/lib/utils';

export interface DashboardProps {
  /** The clock column. On wide screens it sits on the left, on narrow ones on top. */
  readonly clock: React.ReactNode;
  /** The rest of the workspace, shown to the right of the clock. */
  readonly children: React.ReactNode;
  /** Additional classes for the grid. */
  readonly className?: string;
}

/**
 * The dashboard layout: a permanent clock column on the left and the
 * workspace on the right.
 *
 * The clock deliberately sits *outside* the tab boundary. It is the one
 * thing the user must be able to read at any moment, so it is never
 * unmounted — switching to the task queue or the statistics cannot take
 * the countdown off the screen.
 *
 * **The two columns answer different questions.** The clock column is the
 * *session*: what is running, and for how long. The workspace column is
 * the *work*: the task, the day's progress, the settings. A card about
 * the work belongs in the workspace, and a card about the session belongs
 * in the clock.
 *
 * The clock column is also *sticky* on a wide screen, so its height is a
 * budget: what goes in it has to fit in a viewport, or the column cannot
 * stick and its bottom is never seen.
 *
 * On a narrow screen the two columns stack, with the clock on top, so the
 * same component serves the phone layout and the desktop dashboard.
 */
export function Dashboard({ clock, children, className }: DashboardProps) {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 items-start gap-6',
        'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]',
        className,
      )}
    >
      <div
        data-testid="dashboard-clock"
        className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20"
      >
        {clock}
      </div>

      <div
        data-testid="dashboard-workspace"
        className="flex min-w-0 flex-col gap-4"
      >
        {children}
      </div>
    </div>
  );
}
