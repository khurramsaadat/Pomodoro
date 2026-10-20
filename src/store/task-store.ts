import { create } from 'zustand';

import {
  applyFocusSession,
  createTask,
  isOverEstimate,
  markTaskDone,
  removeTask,
  reopenTask,
  sortTasks,
  updateTask,
  type Task,
  type TaskPatch,
} from '@/domain/tasks';
import { tasksRepository } from '@/storage/tasks';

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
  /** Records a completed focus session against the active task. */
  recordFocusSession: () => void;
  /** Removes every task from the queue. */
  clearTasks: () => void;
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
    if (activeTaskId === null) {
      return;
    }

    set({
      tasks: tasks.map((task) => (task.id === activeTaskId ? applyFocusSession(task) : task)),
    });
  },

  clearTasks: () => {
    set({ tasks: [], activeTaskId: null });
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
