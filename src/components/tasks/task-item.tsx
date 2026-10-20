import { Check, Circle, Play, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isOverEstimate, remainingEstimate, type Task } from '@/domain/tasks';
import { cn } from '@/lib/utils';

export interface TaskItemProps {
  readonly task: Task;
  /** Whether this task is the one the user is working on. */
  readonly active: boolean;
  /** Whether the task is shown in the queue at all. */
  readonly onSelect: () => void;
  /** Marks the task as done or reopens it. */
  readonly onToggleDone: () => void;
  /** Removes the task from the queue. */
  readonly onRemove: () => void;
}

/**
 * A single task in the queue.
 *
 * The estimate is shown as a set of pips rather than a number, because
 * "two sessions left" is far quicker to read at a glance than "2/5".
 */
export function TaskItem({ task, active, onSelect, onToggleDone, onRemove }: TaskItemProps) {
  const over = isOverEstimate(task);
  const remaining = remainingEstimate(task);

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border',
        task.done && 'opacity-60',
      )}
      data-testid="task-item"
      data-active={active}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleDone}
        aria-label={task.done ? `Reopen ${task.title}` : `Mark ${task.title} as done`}
        title={task.done ? 'Reopen' : 'Mark as done'}
        className="size-7 shrink-0"
      >
        {task.done ? (
          <Check className="text-success size-4" />
        ) : (
          <Circle className="text-muted-foreground size-4" />
        )}
      </Button>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
        aria-pressed={active}
      >
        <span
          className={cn(
            'block truncate text-sm font-medium',
            task.done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </span>

        <span className="mt-1 flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: task.estimatedPomodoros }, (_, index) => (
            <span
              key={index}
              className={cn(
                'size-1.5 rounded-full',
                index < task.completedPomodoros
                  ? 'bg-primary'
                  : 'bg-border',
              )}
            />
          ))}
          {over ? (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              over estimate
            </Badge>
          ) : null}
        </span>
      </button>

      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {task.done ? 'done' : `${remaining} left`}
      </span>

      {active ? (
        <span
          className="text-primary flex size-7 shrink-0 items-center justify-center"
          aria-label="In progress"
          title="In progress"
        >
          <Play className="size-3.5 fill-current" />
        </span>
      ) : null}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove ${task.title}`}
        title="Remove"
        className="text-muted-foreground size-7 shrink-0"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
