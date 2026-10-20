import { Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { isOverEstimate, type Task } from '@/domain/tasks';
import { cn } from '@/lib/utils';

export interface ActiveTaskProps {
  /** The task the user is working on, or `null` when there is none. */
  readonly task: Task | null;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * The active task, shown under the countdown.
 *
 * The clock column is permanent, and this answers the question the clock
 * itself cannot: *what am I working on?* Without it, the connection between
 * the running timer and the queue is invisible until the stats tab is
 * opened — and the queue can move on by itself, so the answer can change
 * without the user ever seeing the old one.
 */
export function ActiveTask({ task, className }: ActiveTaskProps) {
  if (task === null) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-2.5 px-4 py-3">
          <Target className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm leading-tight font-medium">No active task</span>
            <span className="text-muted-foreground truncate text-[11px] leading-tight">
              Pick one in the queue to track what you are working on.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completed = Math.min(task.completedPomodoros, task.estimatedPomodoros);
  const ratio = task.estimatedPomodoros > 0 ? completed / task.estimatedPomodoros : 0;
  const over = isOverEstimate(task);

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Target className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                'truncate text-sm leading-tight font-medium',
                task.done && 'text-muted-foreground line-through',
              )}
              title={task.title}
            >
              {task.title}
            </span>
          </div>

          {over ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              over estimate
            </Badge>
          ) : (
            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
              {completed} of {task.estimatedPomodoros} focus sessions
            </span>
          )}
        </div>

        <Progress
          value={Math.round(ratio * 100)}
          aria-label={`${completed} of ${task.estimatedPomodoros} focus sessions completed`}
          className="h-1.5"
        />
      </CardContent>
    </Card>
  );
}
