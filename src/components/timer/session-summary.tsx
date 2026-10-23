import { CheckCircle2, CircleSlash, Flame, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTimerStore } from '@/store/timer-store';
import { cn } from '@/lib/utils';

export interface SessionSummaryProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * A compact summary of the session so far.
 *
 * Focus sessions completed, total focus time banked, and how many times the
 * timer was interrupted — the last of these is the metric that actually
 * predicts whether the Pomodoro method is working for the user.
 *
 * The three numbers sit on one line rather than on three, because the card
 * lives in a row with two other cards and a tall card would unbalance it.
 */
export function SessionSummary({ className }: SessionSummaryProps) {
  const state = useTimerStore((store) => store.state);
  const resetAll = useTimerStore((store) => store.resetAll);

  // The focus time is the time that was actually spent focusing, banked from
  // the measured duration of each phase. Multiplying the session count by
  // the *current* focus length would be an estimate that changes with the
  // settings, and would disagree with the statistics panel.
  const focusMinutes = Math.round((state.completedFocusMs || 0) / 60_000);

  const stats = [
    {
      id: 'completed',
      label: 'Sessions',
      value: `${state.totalWorkSessions}`,
      icon: CheckCircle2,
      // A finished session is a good one, and the check already says so.
      tone: 'text-success',
    },
    {
      id: 'time',
      label: 'Focus',
      value: `${focusMinutes}m`,
      icon: Flame,
      // The flame is the one icon in the row that has an obvious colour of
      // its own: the fireplace in the ambience picker is orange too, so the
      // app's fire keeps the same hue wherever it appears.
      tone: 'text-orange-600 dark:text-orange-400',
    },
    {
      id: 'interruptions',
      label: 'Interrupted',
      value: `${state.totalInterruptions}`,
      icon: CircleSlash,
      tone: 'text-warning',
    },
  ] as const;

  return (
    <Card className={cn('py-6', className)}>
      <CardContent className="flex items-center gap-3 px-4 py-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.id} className="flex min-w-0 flex-1 items-center gap-1.5">
              <Icon
                className={cn('size-[18px] shrink-0', stat.tone)}
                aria-hidden="true"
              />
              <span className="tabular-nums text-sm leading-none font-semibold">
                {stat.value}
              </span>
              <span className="text-muted-foreground truncate text-[11px] leading-none">
                {stat.label}
              </span>
            </div>
          );
        })}

        <Button
          variant="ghost"
          size="icon"
          onClick={resetAll}
          aria-label="Reset session"
          title="Reset session"
          className="text-primary size-7 shrink-0 hover:text-primary/80"
        >
          <RotateCcw className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
