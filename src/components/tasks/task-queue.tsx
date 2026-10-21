import { useState } from 'react';
import { CheckCheck, ListTodo, Plus } from 'lucide-react';

import { TaskItem } from '@/components/tasks/task-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isValidTaskTitle, MAX_TASK_ESTIMATE, MIN_TASK_ESTIMATE, splitTasks } from '@/domain/tasks';
import { selectOrderedTasks, useTaskStore } from '@/store/task-store';
import { usePreferencesStore } from '@/store/preferences-store';

export interface TaskQueueProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * The task queue.
 *
 * Tasks are the "what" and the timer is the "how long": a completed focus
 * session is credited to whichever task is active, so the queue fills up with
 * real progress rather than guesswork.
 *
 * The finished tasks are a *section* of their own rather than a tail of the
 * same list. A queue sorted by completion time mixes "what is still to do"
 * with "what is already done", and the finished work ends up below the fold
 * where nobody sees it — which is the opposite of what a completed task is
 * for.
 */
export function TaskQueue({ className }: TaskQueueProps) {
  const tasks = useTaskStore((store) => store.tasks);
  const activeTaskId = useTaskStore((store) => store.activeTaskId);
  const addTask = useTaskStore((store) => store.addTask);
  const updateTask = useTaskStore((store) => store.updateTask);
  const removeTask = useTaskStore((store) => store.removeTask);
  const completeTask = useTaskStore((store) => store.completeTask);
  const reopenTask = useTaskStore((store) => store.reopenTask);
  const setActiveTask = useTaskStore((store) => store.setActiveTask);

  const showCompleted = usePreferencesStore((store) => store.preferences.showCompletedTasks);

  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(1);

  const ordered = selectOrderedTasks(tasks);
  const { open, completed } = splitTasks(ordered);
  const visibleCompleted = showCompleted ? completed : [];

  const canAdd = isValidTaskTitle(title);

  const submit = (): void => {
    if (!canAdd) {
      return;
    }
    addTask(title, estimate);
    setTitle('');
    setEstimate(MIN_TASK_ESTIMATE);
  };

  const renderTask = (task: (typeof ordered)[number]): React.ReactNode => (
    <TaskItem
      key={task.id}
      task={task}
      active={task.id === activeTaskId}
      onSelect={() => setActiveTask(task.id === activeTaskId ? null : task.id)}
      onToggleDone={() => {
        if (task.done) {
          reopenTask(task.id);
        } else {
          completeTask(task.id);
        }
      }}
      onRemove={() => removeTask(task.id)}
      onEdit={(patch) => updateTask(task.id, patch)}
    />
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4" />
          Task queue
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="task-title" className="text-muted-foreground text-xs">
              What are you working on?
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Write the report"
              maxLength={120}
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-estimate" className="text-muted-foreground text-xs">
              Sessions
            </label>
            <Input
              id="task-estimate"
              type="number"
              min={MIN_TASK_ESTIMATE}
              max={MAX_TASK_ESTIMATE}
              value={estimate}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  setEstimate(value);
                }
              }}
              className="h-9 w-20"
            />
          </div>

          <Button type="submit" size="icon" disabled={!canAdd} aria-label="Add task">
            <Plus />
          </Button>
        </form>

        {open.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
            {ordered.length === 0
              ? 'No tasks yet — add one above to start tracking.'
              : 'Everything is done. Enjoy the break.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">{open.map(renderTask)}</ul>
        )}

        {/*
          The finished work is its own section, so it is visible rather
          than being a tail of the queue that has to be scrolled to.
        */}
        {visibleCompleted.length > 0 ? (
          <div className="flex flex-col gap-2 border-t pt-4" data-testid="completed-tasks">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <CheckCheck className="size-3.5" />
              Completed
              <span className="tabular-nums">({visibleCompleted.length})</span>
            </h3>

            <ul className="flex flex-col gap-2">{visibleCompleted.map(renderTask)}</ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
