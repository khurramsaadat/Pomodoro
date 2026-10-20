import { CheckCircle2, CircleSlash, Flame, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTimerStore } from '@/store/timer-store';

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
 */
export function SessionSummary({ className }: SessionSummaryProps) {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);
  const resetAll = useTimerStore((store) => store.resetAll);

  const focusMinutes = Math.round((state.totalWorkSessions * config.workMs) / 60_000);

  const stats = [
    {
      id: 'completed',
      label: 'Focus sessions',
      value: `${state.totalWorkSessions}`,
      icon: CheckCircle2,
    },
    {
      id: 'time',
      label: 'Focus time',
      value: `${focusMinutes} min`,
      icon: Flame,
    },
    {
      id: 'interruptions',
      label: 'Interruptions',
      value: `${state.totalInterruptions}`,
      icon: CircleSlash,
    },
  ] as const;

  return (
    <Card className={className}>
      <CardContent className="grid grid-cols-3 gap-3 px-5 py-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.id} className="flex flex-col items-center gap-1 text-center">
              <Icon className="text-muted-foreground size-4" aria-hidden="true" />
              <span className="tabular-nums text-lg leading-none font-semibold">
                {stat.value}
              </span>
              <span className="text-muted-foreground text-[11px] leading-tight">
                {stat.label}
              </span>
            </div>
          );
        })}
      </CardContent>

      <div className="flex justify-end border-t px-5 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAll}
          className="text-muted-foreground h-7 text-xs"
        >
          <RotateCcw className="size-3.5" />
          Reset session
        </Button>
      </div>
    </Card>
  );
}
