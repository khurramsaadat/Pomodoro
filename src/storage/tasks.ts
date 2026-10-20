import {
  clampEstimate,
  isValidTaskTitle,
  MAX_TASK_ESTIMATE,
  MIN_TASK_ESTIMATE,
  normalizeTaskTitle,
  type Task,
} from '@/domain/tasks';
import { createRepository, isRecord, type Repository } from './repository';

/**
 * Persistence for the task queue.
 *
 * A task is only accepted if it is structurally sound, so a hand-edited or
 * corrupted payload can never put the queue into an impossible state.
 */

export const TASKS_STORAGE_KEY = 'pomodoro-tasks';

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Validates one task, returning `null` when it is unusable. */
export function validateTask(value: unknown): Task | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, title, estimatedPomodoros, completedPomodoros, done, createdAt, completedAt } = value;

  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  if (typeof title !== 'string' || !isValidTaskTitle(title)) {
    return null;
  }
  if (
    typeof estimatedPomodoros !== 'number' ||
    !Number.isFinite(estimatedPomodoros) ||
    estimatedPomodoros < MIN_TASK_ESTIMATE ||
    estimatedPomodoros > MAX_TASK_ESTIMATE
  ) {
    return null;
  }
  if (!isNonNegativeInteger(completedPomodoros)) {
    return null;
  }
  if (typeof done !== 'boolean') {
    return null;
  }
  if (!isNonNegativeInteger(createdAt)) {
    return null;
  }
  if (completedAt !== null && !isNonNegativeInteger(completedAt)) {
    return null;
  }

  return {
    id,
    title: normalizeTaskTitle(title),
    estimatedPomodoros: clampEstimate(estimatedPomodoros),
    completedPomodoros,
    done,
    createdAt,
    completedAt,
  };
}

/** Validates a whole queue, dropping any individual task that is unusable. */
export function validateTaskList(value: unknown): Task[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const tasks: Task[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const task = validateTask(entry);
    if (task && !seen.has(task.id)) {
      seen.add(task.id);
      tasks.push(task);
    }
  }

  return tasks;
}

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
