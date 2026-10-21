import { describe, expect, it } from 'vitest';

import {
  applyFocusSession,
  clampEstimate,
  createTask,
  creditFocusSession,
  isOverEstimate,
  isValidTaskTitle,
  markTaskDone,
  MAX_TASK_ESTIMATE,
  nextOpenTask,
  normalizeTaskTitle,
  remainingEstimate,
  removeTask,
  reopenTask,
  sortTasks,
  splitTasks,
  updateTask,
  validateTask,
  validateTaskList,
  willExceedEstimate,
} from '@/domain/tasks';

const T0 = 1_700_000_000_000;

describe('normalizeTaskTitle', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeTaskTitle('  Write   the   report  ')).toBe('Write the report');
  });

  it('leaves a clean title untouched', () => {
    expect(normalizeTaskTitle('Write the report')).toBe('Write the report');
  });
});

describe('isValidTaskTitle', () => {
  it('rejects an empty or whitespace-only title', () => {
    expect(isValidTaskTitle('')).toBe(false);
    expect(isValidTaskTitle('   ')).toBe(false);
  });

  it('accepts a normal title', () => {
    expect(isValidTaskTitle('Write the report')).toBe(true);
  });
});

describe('clampEstimate', () => {
  it('keeps an estimate inside the supported range', () => {
    expect(clampEstimate(0)).toBe(1);
    expect(clampEstimate(-5)).toBe(1);
    expect(clampEstimate(1000)).toBe(MAX_TASK_ESTIMATE);
  });

  it('rounds a fractional estimate', () => {
    expect(clampEstimate(2.6)).toBe(3);
  });

  it('falls back to the minimum for a non-finite value', () => {
    expect(clampEstimate(Number.NaN)).toBe(1);
  });
});

describe('createTask', () => {
  it('builds an open task with a normalised title', () => {
    const task = createTask('id-1', '  Write   the report ', 3, T0);

    expect(task.id).toBe('id-1');
    expect(task.title).toBe('Write the report');
    expect(task.estimatedPomodoros).toBe(3);
    expect(task.completedPomodoros).toBe(0);
    expect(task.done).toBe(false);
    expect(task.completedAt).toBeNull();
    expect(task.createdAt).toBe(T0);
  });
});

describe('applyFocusSession', () => {
  it('counts the session against the task', () => {
    const task = createTask('id-1', 'Write', 3, T0);

    expect(applyFocusSession(task).completedPomodoros).toBe(1);
  });
});

describe('remainingEstimate', () => {
  it('counts down the estimate', () => {
    const task = createTask('id-1', 'Write', 3, T0);

    expect(remainingEstimate(task)).toBe(3);
    expect(remainingEstimate(applyFocusSession(task))).toBe(2);
  });

  it('never goes below zero', () => {
    let task = createTask('id-1', 'Write', 1, T0);
    task = applyFocusSession(task);
    task = applyFocusSession(task);

    expect(remainingEstimate(task)).toBe(0);
  });
});

describe('isOverEstimate', () => {
  it('is true once the estimate is used up', () => {
    const task = createTask('id-1', 'Write', 1, T0);

    expect(isOverEstimate(task)).toBe(false);
    expect(isOverEstimate(applyFocusSession(task))).toBe(true);
  });
});

describe('markTaskDone', () => {
  it('records when the task was completed', () => {
    const task = markTaskDone(createTask('id-1', 'Write', 2, T0), T0 + 1000);

    expect(task.done).toBe(true);
    expect(task.completedAt).toBe(T0 + 1000);
  });

  it('is idempotent and keeps the original completion time', () => {
    const done = markTaskDone(createTask('id-1', 'Write', 2, T0), T0 + 1000);
    const again = markTaskDone(done, T0 + 5000);

    expect(again.completedAt).toBe(T0 + 1000);
  });
});

describe('reopenTask', () => {
  it('clears the completion time', () => {
    const done = markTaskDone(createTask('id-1', 'Write', 2, T0), T0 + 1000);
    const reopened = reopenTask(done);

    expect(reopened.done).toBe(false);
    expect(reopened.completedAt).toBeNull();
  });
});

describe('updateTask', () => {
  it('applies a title change', () => {
    const task = updateTask(createTask('id-1', 'Write', 2, T0), { title: '  Rewrite  ' }, T0);

    expect(task.title).toBe('Rewrite');
  });

  it('applies an estimate change', () => {
    const task = updateTask(createTask('id-1', 'Write', 2, T0), { estimatedPomodoros: 5 }, T0);

    expect(task.estimatedPomodoros).toBe(5);
  });

  it('marks the task done when the patch says so', () => {
    const task = updateTask(createTask('id-1', 'Write', 2, T0), { done: true }, T0 + 50);

    expect(task.done).toBe(true);
    expect(task.completedAt).toBe(T0 + 50);
  });
});

describe('removeTask', () => {
  it('removes only the matching task', () => {
    const tasks = [createTask('a', 'One', 1, T0), createTask('b', 'Two', 1, T0)];

    expect(removeTask(tasks, 'a').map((task) => task.id)).toEqual(['b']);
  });
});

describe('sortTasks', () => {
  it('puts open tasks first, oldest first', () => {
    const first = createTask('a', 'First', 1, T0);
    const second = createTask('b', 'Second', 1, T0 + 1000);
    const third = createTask('c', 'Third', 1, T0 + 2000);

    const sorted = sortTasks([third, second, first]);

    expect(sorted.map((task) => task.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts completed tasks last, most recently completed first', () => {
    const open = createTask('open', 'Open', 1, T0);
    const oldDone = markTaskDone(createTask('old', 'Old', 1, T0), T0 + 1000);
    const newDone = markTaskDone(createTask('new', 'New', 1, T0), T0 + 2000);

    const sorted = sortTasks([newDone, oldDone, open]);

    expect(sorted.map((task) => task.id)).toEqual(['open', 'new', 'old']);
  });
});

describe('splitTasks', () => {
  it('separates the open tasks from the finished ones', () => {
    const open = createTask('open', 'Open', 1, T0);
    const done = markTaskDone(createTask('done', 'Done', 1, T0), T0 + 1000);

    const split = splitTasks([open, done]);

    expect(split.open.map((task) => task.id)).toEqual(['open']);
    expect(split.completed.map((task) => task.id)).toEqual(['done']);
  });

  it('keeps the completed tasks in the order they were finished', () => {
    const oldDone = markTaskDone(createTask('old', 'Old', 1, T0), T0 + 1000);
    const newDone = markTaskDone(createTask('new', 'New', 1, T0), T0 + 2000);

    const split = splitTasks([oldDone, newDone]);

    // The most recently completed is the one the user just finished.
    expect(split.completed.map((task) => task.id)).toEqual(['new', 'old']);
  });

  it('handles an empty queue', () => {
    const split = splitTasks([]);

    expect(split.open).toEqual([]);
    expect(split.completed).toEqual([]);
  });
});

describe('validateTask', () => {
  it('accepts a well-formed task', () => {
    const task = createTask('task-1', 'Write the report', 3, T0);

    expect(validateTask(task)).toEqual(task);
  });

  it('rejects a task with no id', () => {
    const task = { ...createTask('task-1', 'Write the report', 3, T0), id: '' };

    expect(validateTask(task)).toBeNull();
  });

  it('rejects a task with an impossible estimate', () => {
    const task = { ...createTask('task-1', 'Write the report', 3, T0), estimatedPomodoros: 0 };

    expect(validateTask(task)).toBeNull();
  });

  it('rejects a task with a fractional session count', () => {
    const task = { ...createTask('task-1', 'Write the report', 3, T0), completedPomodoros: 1.5 };

    expect(validateTask(task)).toBeNull();
  });

  it('rejects values that are not objects', () => {
    expect(validateTask(null)).toBeNull();
    expect(validateTask('task')).toBeNull();
  });
});

describe('validateTaskList', () => {
  it('drops the unusable tasks and keeps the rest', () => {
    const good = createTask('good', 'Good', 1, T0);
    const bad = { ...createTask('bad', 'Bad', 1, T0), id: '' };

    const tasks = validateTaskList([good, bad]);

    // One broken task must not cost the user the rest of the queue.
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0]?.id).toBe('good');
  });

  it('drops a duplicate id', () => {
    const task = createTask('task-1', 'Write the report', 1, T0);

    expect(validateTaskList([task, task])).toHaveLength(1);
  });

  it('rejects a value that is not a list', () => {
    expect(validateTaskList({ tasks: [] })).toBeNull();
  });
});

describe('nextOpenTask', () => {
  it('picks the first open task that is not the current one', () => {
    const first = createTask('first', 'First', 1, T0);
    const second = createTask('second', 'Second', 1, T0 + 1);

    expect(nextOpenTask([first, second], 'first')?.id).toBe('second');
  });

  it('skips the tasks that are done', () => {
    const first = { ...createTask('first', 'First', 1, T0), done: true };
    const second = createTask('second', 'Second', 1, T0 + 1);

    expect(nextOpenTask([first, second], 'first')?.id).toBe('second');
  });

  it('has nothing to offer when the current task is the only open one', () => {
    const only = createTask('only', 'Only', 1, T0);

    expect(nextOpenTask([only], 'only')).toBeNull();
  });
});

describe('willExceedEstimate', () => {
  it('is false while there is budget left after the next session', () => {
    const task = createTask('task', 'Write the report', 3, T0);

    expect(willExceedEstimate(task)).toBe(false);
  });

  it('is true when the next session is the last one on the task', () => {
    // Two sessions done out of three: the third is the last one.
    const task = { ...createTask('task', 'Write the report', 3, T0), completedPomodoros: 2 };

    expect(willExceedEstimate(task)).toBe(true);
  });

  it('is true for a task estimated at a single session', () => {
    const task = createTask('task', 'Write the report', 1, T0);

    expect(willExceedEstimate(task)).toBe(true);
  });
});

describe('creditFocusSession', () => {
  it('banks the session against the active task', () => {
    const task = createTask('task', 'Write the report', 3, T0);

    const result = creditFocusSession([task], 'task', true);

    expect(result.tasks[0]?.completedPomodoros).toBe(1);
    expect(result.activeTaskId).toBe('task');
    expect(result.advanced).toBe(false);
  });

  it('does nothing when there is no active task', () => {
    const task = createTask('task', 'Write the report', 3, T0);

    const result = creditFocusSession([task], null, true);

    expect(result.tasks[0]?.completedPomodoros).toBe(0);
    expect(result.activeTaskId).toBeNull();
  });

  it('moves on when the task has used up its estimate', () => {
    const first = createTask('first', 'First', 1, T0);
    const second = createTask('second', 'Second', 2, T0 + 1);

    const result = creditFocusSession([first, second], 'first', true);

    // The session banked the first task over its estimate, so the queue
    // moved on to the next one.
    expect(result.tasks[0]?.completedPomodoros).toBe(1);
    expect(result.activeTaskId).toBe('second');
    expect(result.advanced).toBe(true);
  });

  it('stays put when the user has turned the auto-advance off', () => {
    const first = createTask('first', 'First', 1, T0);
    const second = createTask('second', 'Second', 2, T0 + 1);

    const result = creditFocusSession([first, second], 'first', false);

    expect(result.activeTaskId).toBe('first');
    expect(result.advanced).toBe(false);
  });

  it('clears the pointer when there is nothing to move on to', () => {
    const only = createTask('only', 'Only', 1, T0);

    const result = creditFocusSession([only], 'only', true);

    // The task is over budget, but there is no other task to move to, so
    // the pointer is cleared rather than left pointing at itself.
    expect(result.activeTaskId).toBeNull();
    expect(result.advanced).toBe(false);
  });

  it('moves on only once the session has been banked', () => {
    // A task estimated at two sessions is not over budget after one.
    const first = createTask('first', 'First', 2, T0);
    const second = createTask('second', 'Second', 2, T0 + 1);

    const result = creditFocusSession([first, second], 'first', true);

    expect(result.activeTaskId).toBe('first');
    expect(result.advanced).toBe(false);
  });

  it('leaves the queue untouched when it cannot advance', () => {
    const first = createTask('first', 'First', 1, T0);
    const second = createTask('second', 'Second', 2, T0 + 1);

    const result = creditFocusSession([first, second], 'first', true);

    // The second task was not given a session of its own.
    expect(result.tasks[1]?.completedPomodoros).toBe(0);
  });
});
