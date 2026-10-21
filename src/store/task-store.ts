import { create } from 'zustand';

import {
  createTask,
  creditFocusSession,
  isOverEstimate,
  markTaskDone,
  nextOpenTask,
  removeTask,
  reopenTask,
  sortTasks,
  updateTask,
  willExceedEstimate,
  type Task,
  type TaskPatch,
} from '@/domain/tasks';
import { tasksRepository } from '@/storage/tasks';
import { usePreferencesStore } from './preferences-store';

/**
 * The task queue.
 *
 * One task is *active* at a time: the one the user is currently working on.
 * A completed focus session is attributed to the active task, which is what
 * connects the timer to the queue and to the statistics.
 */

export interface TaskStore {
  /** Every task, in insertion order. */
  readonly tasks: readonly Task[];
  /** The id of the task in progress, or `null` when no task is selected. */
  readonly activeTaskId: string | null;
  /** Adds a task to the queue. */
  addTask: (title: string, estimatedPomodoros: number) => void;
  /** Edits a task. */
  updateTask: (id: string, patch: TaskPatch) => void;
  /** Removes a task from the queue. */
  removeTask: (id: string) => void;
  /** Marks a task as done. */
  completeTask: (id: string) => void;
  /** Reopens a completed task. */
  reopenTask: (id: string) => void;
  /** Makes a task the active one. */
  setActiveTask: (id: string | null) => void;
  /**
   * Records a completed focus session against the active task.
   *
   * The session is credited and the auto-advance policy is applied in the
   * same step, so a session can never be banked without the queue being
   * given the chance to move on. See `creditFocusSession`.
   */
  recordFocusSession: () => void;
  /**
   * Moves the active task on to the next open one.
   *
   * Used when the active task has used up its estimate and the user has
   * asked for the queue to advance by itself.
   */
  advanceToNextTask: () => void;
  /** Removes every task from the queue. */
  clearTasks: () => void;
  /**
   * Replaces the whole queue at once.
   *
   * This is what an import uses: the backup is a *whole* queue, and
   * replacing it entry by entry would leave the user's own tasks mixed in
   * with the imported ones.
   */
  setTasks: (tasks: readonly Task[], activeTaskId: string | null) => void;
  /** Restores the queue from storage. */
  restore: () => void;
}

function now(): number {
  return Date.now();
}

/**
 * Generates an id for a new task.
 *
 * A timestamp is enough here: tasks are created one at a time by a human,
 * so a collision is not a realistic concern, and a counter would have to be
 * persisted to stay correct across reloads.
 */
let idCounter = 0;
function nextTaskId(): string {
  idCounter += 1;
  return `task-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export const useTaskStore = create<TaskStore>()((set, get) => ({
  tasks: [],
  activeTaskId: null,

  addTask: (title, estimatedPomodoros) => {
    const task = createTask(nextTaskId(), title, estimatedPomodoros, now());
    set((store) => ({ tasks: [...store.tasks, task] }));
  },

  updateTask: (id, patch) => {
    set((store) => ({
      tasks: store.tasks.map((task) => (task.id === id ? updateTask(task, patch, now()) : task)),
    }));
  },

  removeTask: (id) => {
    set((store) => ({
      tasks: removeTask(store.tasks, id),
      // The active task cannot outlive its removal.
      activeTaskId: store.activeTaskId === id ? null : store.activeTaskId,
    }));
  },

  completeTask: (id) => {
    set((store) => ({
      tasks: store.tasks.map((task) => (task.id === id ? markTaskDone(task, now()) : task)),
    }));
  },

  reopenTask: (id) => {
    set((store) => ({
      tasks: store.tasks.map((task) => (task.id === id ? reopenTask(task) : task)),
    }));
  },

  setActiveTask: (id) => {
    set({ activeTaskId: id });
  },

  recordFocusSession: () => {
    const { tasks, activeTaskId } = get();

    // The auto-advance preference is read here rather than being passed in,
    // so that every path that credits a session gets the same policy. The
    // preference lives in its own store, and reading it through the store's
    // own state is what keeps the two from drifting apart.
    const autoAdvance = usePreferencesStore.getState().preferences.autoAdvanceTask;
    const credit = creditFocusSession(tasks, activeTaskId, autoAdvance);

    set({ tasks: credit.tasks, activeTaskId: credit.activeTaskId });
  },

  advanceToNextTask: () => {
    const { tasks, activeTaskId } = get();

    // The next task is the first open one that is not the current one, in
    // display order. When the current task is the only open one, the active
    // task is cleared rather than pointing at itself.
    const next = nextOpenTask(tasks, activeTaskId);

    set({ activeTaskId: next ? next.id : null });
  },

  clearTasks: () => {
    set({ tasks: [], activeTaskId: null });
  },

  setTasks: (tasks, activeTaskId) => {
    // The selection is only kept when it still refers to a task that
    // exists, so an import cannot leave the app pointing at nothing.
    const selection =
      activeTaskId !== null && tasks.some((task) => task.id === activeTaskId)
        ? activeTaskId
        : null;

    set({ tasks: [...tasks], activeTaskId: selection });
  },

  restore: () => {
    const stored = tasksRepository.read();
    if (stored === null) {
      return;
    }
    set({ tasks: stored.tasks, activeTaskId: stored.activeTaskId });
  },
}));

/** The tasks in display order: open first, then completed. */
export function selectOrderedTasks(tasks: readonly Task[]): Task[] {
  return sortTasks(tasks);
}

/** The task the user is currently working on, if there is one. */
export function selectActiveTask(state: TaskStore): Task | null {
  if (state.activeTaskId === null) {
    return null;
  }
  return state.tasks.find((task) => task.id === state.activeTaskId) ?? null;
}

/** Whether the active task has used up its estimate. */
export function selectActiveTaskOverEstimate(state: TaskStore): boolean {
  const task = selectActiveTask(state);
  return task === null ? false : isOverEstimate(task);
}

/**
 * The task the queue would move on to, or `null` if it would not move.
 *
 * The queue moves when the active task has used up its estimate and the
 * user has asked for the queue to advance by itself, so the answer is
 * `null` in every other case. The "next up" line under the clock is drawn
 * from this, and it is only shown when the move is really going to happen
 * — a line that names a task the app is not going to switch to would be
 * worse than no line at all.
 *
 * The task is the one the queue would move to *after the next session*,
 * so a task that is about to run out of budget counts even though it has
 * not run out of it yet.
 */
export function selectNextTask(state: TaskStore, autoAdvance: boolean): Task | null {
  if (!autoAdvance) {
    return null;
  }

  const active = selectActiveTask(state);
  if (active === null || !willExceedEstimate(active)) {
    return null;
  }

  return nextOpenTask(state.tasks, state.activeTaskId);
}
