/**
 * The task queue: the things the user intends to work on.
 *
 * A task is deliberately simple — a title, an estimate in focus sessions, and
 * a count of how many sessions have been spent on it. The queue is the
 * bridge between "what the user intends to do" and "what the timer actually
 * did", so a completed focus session is attributed to the active task.
 */

/** A unit of work the user intends to complete. */
export interface Task {
  readonly id: string;
  readonly title: string;
  /** How many focus sessions the user expects this to take. */
  readonly estimatedPomodoros: number;
  /** How many focus sessions have been completed against it. */
  readonly completedPomodoros: number;
  readonly done: boolean;
  /** When the task was added, in epoch ms. */
  readonly createdAt: number;
  /** When the task was marked done. `null` while it is still open. */
  readonly completedAt: number | null;
}

/** The fields of a task that the user can edit. */
export interface TaskPatch {
  readonly title?: string | undefined;
  readonly estimatedPomodoros?: number | undefined;
  readonly done?: boolean | undefined;
}

/** The smallest number of focus sessions a task can be estimated at. */
export const MIN_TASK_ESTIMATE = 1;

/** The largest number of focus sessions a task can be estimated at. */
export const MAX_TASK_ESTIMATE = 24;

/** The longest title a task may have. */
export const MAX_TASK_TITLE_LENGTH = 120;

/**
 * Trims a title and collapses internal whitespace.
 *
 * The collapse matters because titles arrive from a text input, where a
 * stray double space would otherwise persist forever.
 */
export function normalizeTaskTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

/** Whether a title is usable as a task name. */
export function isValidTaskTitle(title: string): boolean {
  const normalized = normalizeTaskTitle(title);
  return normalized.length > 0 && normalized.length <= MAX_TASK_TITLE_LENGTH;
}

/** Clamps an estimate into the supported range, rounding to whole sessions. */
export function clampEstimate(estimate: number): number {
  if (!Number.isFinite(estimate)) {
    return MIN_TASK_ESTIMATE;
  }
  return Math.min(MAX_TASK_ESTIMATE, Math.max(MIN_TASK_ESTIMATE, Math.round(estimate)));
}

/** Builds a new task. The caller supplies the id so the domain stays pure. */
export function createTask(
  id: string,
  title: string,
  estimatedPomodoros: number,
  now: number,
): Task {
  return {
    id,
    title: normalizeTaskTitle(title),
    estimatedPomodoros: clampEstimate(estimatedPomodoros),
    completedPomodoros: 0,
    done: false,
    createdAt: now,
    completedAt: null,
  };
}

/** The focus sessions still expected before the task is over budget. */
export function remainingEstimate(task: Task): number {
  return Math.max(0, task.estimatedPomodoros - task.completedPomodoros);
}

/** Whether the task has used up its estimate. */
export function isOverEstimate(task: Task): boolean {
  return task.completedPomodoros >= task.estimatedPomodoros;
}

/** Records a completed focus session against the task. */
export function applyFocusSession(task: Task): Task {
  return { ...task, completedPomodoros: task.completedPomodoros + 1 };
}

/** Marks the task as done. */
export function markTaskDone(task: Task, now: number): Task {
  if (task.done) {
    return task;
  }
  return { ...task, done: true, completedAt: now };
}

/** Reopens a completed task. */
export function reopenTask(task: Task): Task {
  if (!task.done) {
    return task;
  }
  return { ...task, done: false, completedAt: null };
}

/** Applies a partial edit to a task. */
export function updateTask(task: Task, patch: TaskPatch, now: number): Task {
  const next: Task = {
    ...task,
    title: patch.title === undefined ? task.title : normalizeTaskTitle(patch.title),
    estimatedPomodoros:
      patch.estimatedPomodoros === undefined
        ? task.estimatedPomodoros
        : clampEstimate(patch.estimatedPomodoros),
  };

  if (patch.done === undefined) {
    return next;
  }
  return patch.done ? markTaskDone(next, now) : reopenTask(next);
}

/** Removes a task from the queue. */
export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

/**
 * Orders the queue for display.
 *
 * Open tasks come first, oldest first, so the queue reads as a to-do list.
 * Completed tasks are pushed to the end, most recently completed first.
 */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    if (a.done) {
      return (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt);
    }
    return a.createdAt - b.createdAt;
  });
}
