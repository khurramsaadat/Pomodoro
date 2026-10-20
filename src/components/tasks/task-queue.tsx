import { useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';

import { TaskItem } from '@/components/tasks/task-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isValidTaskTitle, MAX_TASK_ESTIMATE, MIN_TASK_ESTIMATE } from '@/domain/tasks';
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
  const visible = showCompleted ? ordered : ordered.filter((task) => !task.done);
  const open = visible.filter((task) => !task.done);

  const canAdd = isValidTaskTitle(title);

  const submit = (): void => {
    if (!canAdd) {
      return;
    }
    addTask(title, estimate);
    setTitle('');
    setEstimate(MIN_TASK_ESTIMATE);
  };

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
            {visible.length === 0
              ? 'No tasks yet — add one above to start tracking.'
              : 'Everything is done. Enjoy the break.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((task) => (
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
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
