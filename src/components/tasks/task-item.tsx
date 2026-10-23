import { useState } from 'react';
import { Check, Circle, Pencil, Play, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  isOverEstimate,
  isValidTaskTitle,
  MAX_TASK_ESTIMATE,
  MIN_TASK_ESTIMATE,
  remainingEstimate,
  type Task,
  type TaskPatch,
} from '@/domain/tasks';
import { cn } from '@/lib/utils';

export interface TaskItemProps {
  readonly task: Task;
  /** Whether this task is the one the user is working on. */
  readonly active: boolean;
  /** Whether the task is shown in the queue at all. */
  readonly onSelect: () => void;
  /** Makes this task active and starts the clock on it. */
  readonly onPlay: () => void;
  /** Marks the task as done or reopens it. */
  readonly onToggleDone: () => void;
  /** Removes the task from the queue. */
  readonly onRemove: () => void;
  /** Applies an edit to the task. */
  readonly onEdit: (patch: TaskPatch) => void;
}

/**
 * A single task in the queue.
 *
 * The estimate is shown as a set of pips rather than a number, because
 * "two sessions left" is far quicker to read at a glance than "2/5".
 *
 * A task can be edited in place. The title and the estimate are both
 * wrong-able after the fact — a task is often added with a rough title
 * and a guessed estimate, and neither of those can be corrected if the
 * only way to change them is to delete the task and lose its history.
 */
export function TaskItem({
  task,
  active,
  onSelect,
  onPlay,
  onToggleDone,
  onRemove,
  onEdit,
}: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(task.estimatedPomodoros);

  const over = isOverEstimate(task);
  const remaining = remainingEstimate(task);

  const startEditing = (): void => {
    setTitle(task.title);
    setEstimate(task.estimatedPomodoros);
    setEditing(true);
  };

  const cancel = (): void => {
    setEditing(false);
    setTitle(task.title);
    setEstimate(task.estimatedPomodoros);
  };

  const save = (): void => {
    if (!isValidTaskTitle(title)) {
      return;
    }
    onEdit({ title, estimatedPomodoros: estimate });
    setEditing(false);
  };

  if (editing) {
    return (
      <li
        className="border-primary bg-primary/5 flex animate-in flex-col gap-2 rounded-lg border px-3 py-2.5 fade-in-0 slide-in-from-bottom-1 duration-200"
        data-testid="task-item"
        data-editing="true"
      >
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Task title"
            maxLength={120}
            autoFocus
            className="h-8"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            }}
          />

          <Input
            type="number"
            value={estimate}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                setEstimate(value);
              }
            }}
            aria-label="Estimated focus sessions"
            min={MIN_TASK_ESTIMATE}
            max={MAX_TASK_ESTIMATE}
            className="h-8 w-20"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="text-muted-foreground h-7 text-xs"
          >
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!isValidTaskTitle(title)}
            className="h-7 text-xs"
          >
            <Check className="size-3.5" />
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        'flex animate-in items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors fade-in-0 slide-in-from-bottom-1 duration-200',
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
          <Check className="text-success size-4 animate-in duration-150 zoom-in-0" />
        ) : (
          <Circle className="text-muted-foreground size-4 animate-in duration-150 zoom-in-0" />
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

      {/*
        Play *starts* the session on this task: it makes the task active and
        starts the clock in one press, so a session can begin from the queue
        rather than from a trip back to the clock. The filled icon is the
        task that is already running.
      */}
      {task.done ? null : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onPlay}
          aria-label={`Start focusing on ${task.title}`}
          title="Start focusing"
          className={cn(
            'size-7 shrink-0',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Play className={cn('size-3.5', active && 'fill-current')} />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={startEditing}
        aria-label={`Edit ${task.title}`}
        title="Edit"
        className="text-muted-foreground size-7 shrink-0"
      >
        <Pencil className="size-3.5" />
      </Button>

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
