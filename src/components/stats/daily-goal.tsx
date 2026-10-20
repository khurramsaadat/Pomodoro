import { Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface DailyGoalProps {
  /** The focus sessions completed today. */
  readonly sessions: number;
  /** The daily goal, in focus sessions. */
  readonly goal: number;
  /** Whether the goal has been met. */
  readonly met: boolean;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * Today's progress against the daily goal.
 *
 * The goal is the thing the user is working toward, so it belongs beside the
 * clock rather than behind a tab. A bar reads faster than the "3 / 8" text
 * the statistics panel shows, and the badge is what makes the last session
 * of the day feel like an achievement.
 */
export function DailyGoal({ sessions, goal, met, className }: DailyGoalProps) {
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.min(1, sessions / safeGoal);

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-2.5 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="text-muted-foreground size-4" aria-hidden="true" />
            <span className="text-sm font-medium">Daily goal</span>
          </div>

          {met ? (
            <Badge variant="secondary" className="text-[10px]">
              Goal reached
            </Badge>
          ) : null}
        </div>

        <Progress
          value={Math.round(ratio * 100)}
          aria-label={`${sessions} of ${safeGoal} focus sessions completed today`}
        />

        <span className="text-muted-foreground text-[11px] tabular-nums">
          {sessions} of {safeGoal} focus sessions today
        </span>
      </CardContent>
    </Card>
  );
}
