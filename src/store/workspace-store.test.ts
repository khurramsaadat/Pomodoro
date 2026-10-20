import { beforeEach, describe, expect, it } from 'vitest';

import { defaultConfig } from '@/domain/presets';
import { createInitialState } from '@/domain/timer';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { selectActiveTask, useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * The workspace stores are module-level singletons, so each test resets the
 * ones it touches to keep the suites independent.
 */
function resetStores(): void {
  useTimerStore.setState({
    state: createInitialState(defaultConfig()),
    config: defaultConfig(),
  });
  useTaskStore.setState({ tasks: [], activeTaskId: null });
  useHistoryStore.setState({ entries: [] });
  usePreferencesStore.setState({
    preferences: {
      dailyGoal: 8,
      autoAdvanceTask: true,
      soundEnabled: true,
      confirmBeforeClearing: true,
      showCompletedTasks: true,
    },
  });
}

describe('task store', () => {
  beforeEach(() => {
    resetStores();
  });

  it('adds a task to the queue', () => {
    useTaskStore.getState().addTask('Write the report', 3);

    const tasks = useTaskStore.getState().tasks;

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Write the report');
    expect(tasks[0]?.estimatedPomodoros).toBe(3);
  });

  it('tracks the active task', () => {
    useTaskStore.getState().addTask('Write the report', 3);
    const id = useTaskStore.getState().tasks[0]?.id ?? '';

    useTaskStore.getState().setActiveTask(id);

    expect(selectActiveTask(useTaskStore.getState())?.id).toBe(id);
  });

  it('clears the active task when it is removed', () => {
    useTaskStore.getState().addTask('Write the report', 3);
    const id = useTaskStore.getState().tasks[0]?.id ?? '';
    useTaskStore.getState().setActiveTask(id);

    useTaskStore.getState().removeTask(id);

    expect(useTaskStore.getState().activeTaskId).toBeNull();
  });

  it('counts a focus session against the active task only', () => {
    useTaskStore.getState().addTask('First', 2);
    useTaskStore.getState().addTask('Second', 2);
    const [first, second] = useTaskStore.getState().tasks;
    useTaskStore.getState().setActiveTask(first?.id ?? '');

    useTaskStore.getState().recordFocusSession();

    const tasks = useTaskStore.getState().tasks;
    expect(tasks.find((task) => task.id === first?.id)?.completedPomodoros).toBe(1);
    expect(tasks.find((task) => task.id === second?.id)?.completedPomodoros).toBe(0);
  });

  it('does nothing when there is no active task', () => {
    useTaskStore.getState().addTask('First', 2);

    useTaskStore.getState().recordFocusSession();

    expect(useTaskStore.getState().tasks[0]?.completedPomodoros).toBe(0);
  });
});

describe('history store', () => {
  beforeEach(() => {
    resetStores();
  });

  it('records the most recent session first', () => {
    const completion = {
      phase: 'work' as const,
      startedAt: 1000,
      endedAt: 2000,
      durationMs: 25 * 60_000,
      interruptions: 0,
      voided: false,
    };

    useHistoryStore.getState().record(completion, null);
    useHistoryStore.getState().record({ ...completion, endedAt: 3000 }, null);

    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.endedAt).toBe(3000);
  });

  it('attributes the session to the task it names', () => {
    useHistoryStore.getState().record(
      {
        phase: 'work',
        startedAt: 1000,
        endedAt: 2000,
        durationMs: 1000,
        interruptions: 0,
        voided: false,
      },
      { id: 'task-1', title: 'Write the report' },
    );

    const entry = useHistoryStore.getState().entries[0];
    expect(entry?.taskId).toBe('task-1');
    expect(entry?.taskTitle).toBe('Write the report');
  });
});

describe('preferences store', () => {
  beforeEach(() => {
    resetStores();
  });

  it('updates a single preference', () => {
    usePreferencesStore.getState().updatePreference('dailyGoal', 12);

    expect(usePreferencesStore.getState().preferences.dailyGoal).toBe(12);
    // The other preferences are untouched.
    expect(usePreferencesStore.getState().preferences.soundEnabled).toBe(true);
  });
});

describe('timer and workspace integration', () => {
  beforeEach(() => {
    resetStores();
  });

  it('records a completed focus session in the history', () => {
    // The timer is run past its deadline, so the phase really completes
    // rather than being completed from an idle state.
    useTimerStore.setState({
      state: {
        ...useTimerStore.getState().state,
        status: 'running',
        endsAt: Date.now() - 1000,
        startedAt: Date.now() - 25 * 60_000,
      },
    });

    useTimerStore.getState().complete();

    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.phase).toBe('work');
    expect(entries[0]?.durationMs).toBe(25 * 60_000);
  });

  it('credits the completed session to the active task', () => {
    useTaskStore.getState().addTask('Write the report', 3);
    const id = useTaskStore.getState().tasks[0]?.id ?? '';
    useTaskStore.getState().setActiveTask(id);

    useTimerStore.setState({
      state: {
        ...useTimerStore.getState().state,
        status: 'running',
        endsAt: Date.now() - 1000,
        startedAt: Date.now() - 25 * 60_000,
      },
    });

    useTimerStore.getState().complete();

    const task = useTaskStore.getState().tasks[0];
    expect(task?.completedPomodoros).toBe(1);
    expect(useHistoryStore.getState().entries[0]?.taskId).toBe(id);
  });

  it('records the break without crediting a task', () => {
    useTaskStore.getState().addTask('Write the report', 3);
    const id = useTaskStore.getState().tasks[0]?.id ?? '';
    useTaskStore.getState().setActiveTask(id);

    // Finish the focus session, then the break that follows it.
    useTimerStore.setState({
      state: {
        ...useTimerStore.getState().state,
        status: 'running',
        endsAt: Date.now() - 1000,
        startedAt: Date.now() - 25 * 60_000,
      },
    });
    useTimerStore.getState().complete();

    useTimerStore.setState({
      state: {
        ...useTimerStore.getState().state,
        status: 'running',
        endsAt: Date.now() - 1000,
        startedAt: Date.now() - 5 * 60_000,
      },
    });
    useTimerStore.getState().complete();

    const entries = useHistoryStore.getState().entries;
    expect(entries[0]?.phase).toBe('shortBreak');
    // A break is not focus time, so the task is not credited for it.
    expect(useTaskStore.getState().tasks[0]?.completedPomodoros).toBe(1);
  });
});
