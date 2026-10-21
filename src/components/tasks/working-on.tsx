import { ArrowRight, Target } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { willExceedEstimate, type Task } from '@/domain/tasks';
import { cn } from '@/lib/utils';

export interface WorkingOnProps {
  /** The task the user is working on, or `null` when there is none. */
  readonly task: Task | null;
  /**
   * The task the queue would move on to.
   *
   * It is shown only when the move is actually going to happen, so the
   * line is a promise the app keeps rather than a guess.
   */
  readonly nextTask: Task | null;
  /** Called when the strip is activated. */
  readonly onOpen?: (() => void) | undefined;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * What the user is working on, shown under the clock.
 *
 * The countdown answers *how long is left*; it does not answer *on what*.
 * Those are two different questions, and a timer that only answers the
 * first one leaves the user working on something they have to remember.
 *
 * So the answer sits directly under the clock, where the eye already is
 * every time it looks at the time, rather than in the workspace column
 * where it has to be looked for.
 *
 * It is a *strip* rather than a card because it is a status, not a
 * document. It carries the three things that matter — what the task is,
 * how far through it is, and what happens next — in a couple of lines.
 *
 * **The "next up" line is the point of the auto-advance being visible.**
 * The queue moves on by itself once a task has used up its estimate, and
 * until now that happened silently: the title under the clock changed
 * without explanation. Saying what is coming next turns a surprising
 * change into a plan.
 */
export function WorkingOn({ task, nextTask, onOpen, className }: WorkingOnProps) {
  if (task === null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'bg-card text-card-foreground flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left shadow-sm',
          'transition-colors hover:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
          className,
        )}
        data-testid="working-on"
      >
        <span
          className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg"
          aria-hidden="true"
        >
          <Target className="size-3.5" />
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="text-muted-foreground text-[11px] leading-tight font-medium tracking-wide uppercase">
            Working on
          </span>
          <span className="text-muted-foreground truncate text-sm leading-tight">
            No active task
          </span>
        </span>
      </button>
    );
  }

  const completed = Math.min(task.completedPomodoros, task.estimatedPomodoros);
  const ratio = task.estimatedPomodoros > 0 ? completed / task.estimatedPomodoros : 0;
  const movingOn = willExceedEstimate(task);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'bg-card text-card-foreground flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left shadow-sm',
        'transition-colors hover:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        className,
      )}
      data-testid="working-on"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg"
          aria-hidden="true"
        >
          <Target className="size-3.5" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-[11px] leading-tight font-medium tracking-wide uppercase">
            Working on
          </span>
          <span
            className={cn(
              'truncate text-sm leading-tight font-medium',
              task.done && 'text-muted-foreground line-through',
            )}
            title={task.title}
          >
            {task.title}
          </span>
        </span>

        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          {completed}/{task.estimatedPomodoros}
        </span>
      </span>

      <Progress
        value={Math.round(ratio * 100)}
        aria-label={`${completed} of ${task.estimatedPomodoros} focus sessions completed`}
        className="h-1"
      />

      {/*
        The next task is only named when the move is actually going to
        happen, so the line never promises something the app will not do.
      */}
      {nextTask !== null ? (
        <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-[11px] leading-tight">
          <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Next: <span className="text-foreground font-medium">{nextTask.title}</span>
          </span>
        </span>
      ) : movingOn ? (
        <span className="text-muted-foreground text-[11px] leading-tight">
          This is the last session on this task.
        </span>
      ) : null}
    </button>
  );
}
