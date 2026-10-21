import { isRecord } from '@/domain/guards';
import { validateTaskList, type Task } from '@/domain/tasks';
import { createRepository, type Repository } from './repository';

/**
 * Persistence for the task queue.
 *
 * A task is only accepted if it is structurally sound, so a hand-edited or
 * corrupted payload can never put the queue into an impossible state. The
 * validation itself lives in the domain, because an imported backup has to
 * be checked by exactly the same rules.
 */

export const TASKS_STORAGE_KEY = 'pomodoro-tasks';

/** The persisted shape of the queue: the tasks plus the selected one. */
export interface PersistedTasks {
  readonly tasks: readonly Task[];
  /** The id of the task in progress, or `null` when no task is selected. */
  readonly activeTaskId: string | null;
}

/**
 * Validates the persisted queue.
 *
 * The active task is persisted alongside the tasks because a session that
 * completes while the app is closed has to be credited to the task the user
 * was working on, and the selection would otherwise be lost on reload.
 */
export function validatePersistedTasks(value: unknown): PersistedTasks | null {
  if (!isRecord(value)) {
    return null;
  }

  const tasks = validateTaskList(value.tasks);
  if (tasks === null) {
    return null;
  }

  const activeTaskId =
    typeof value.activeTaskId === 'string' ? value.activeTaskId : null;

  // The selection is only kept when it still refers to a task that exists.
  const selection = activeTaskId !== null && tasks.some((task) => task.id === activeTaskId)
    ? activeTaskId
    : null;

  return { tasks, activeTaskId: selection };
}

/** The repository that owns the task queue. */
export const tasksRepository: Repository<PersistedTasks> = createRepository<PersistedTasks>({
  key: TASKS_STORAGE_KEY,
  validate: validatePersistedTasks,
});
