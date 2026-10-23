import { Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface DailyGoalProps {
  /** The focus sessions completed today. */
  readonly sessions: number;
  /** The measured focus time served today, in milliseconds. */
  readonly focusMs: number;
  /** The daily goal, in the unit `mode` names. */
  readonly goal: number;
  /** Whether the goal counts sessions or measured focus minutes. */
  readonly mode: 'sessions' | 'minutes';
  /** Whether the goal has been met. */
  readonly met: boolean;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * Today's progress against the daily goal.
 *
 * The goal is the thing the user is working toward, so it belongs above the
 * workspace rather than behind a tab. A bar reads faster than the "3 / 8"
 * text the statistics panel shows, and the badge is what makes the last
 * session of the day feel like an achievement.
 *
 * It sits directly *under* the task the user is working on, because the two
 * are the same question asked twice: what am I working on, and how far have
 * I got today. Reading them together is the point.
 *
 * The goal may count sessions or minutes. The minute reading is the
 * *measured* focus time, so eight short sprints and eight long sessions are
 * finally different days.
 */
export function DailyGoal({ sessions, focusMs, goal, mode, met, className }: DailyGoalProps) {
  const safeGoal = goal > 0 ? goal : 1;
  const minutes = Math.round(focusMs / 60_000);
  const done = mode === 'minutes' ? minutes : sessions;
  const ratio = Math.min(1, done / safeGoal);

  const unitLabel = mode === 'minutes' ? 'focus minutes' : 'focus sessions';
  const reading = `${done} of ${safeGoal} ${unitLabel} today`;

  return (
    <Card className={cn('py-0', className)}>
      <CardContent className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Target className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-sm leading-tight font-medium">Daily goal</span>
          </div>

          {met ? (
            <Badge variant="secondary" className="shrink-0 animate-in duration-200 text-[10px] zoom-in-0">
              Goal reached
            </Badge>
          ) : (
            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
              {reading}
            </span>
          )}
        </div>

        <Progress
          value={Math.round(ratio * 100)}
          aria-label={`${reading.replace(' today', '')} completed today`}
          className="h-1.5"
        />
      </CardContent>
    </Card>
  );
}
