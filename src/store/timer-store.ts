import { create } from 'zustand';

import { defaultConfig } from '@/domain/presets';
import { isOverEstimate } from '@/domain/tasks';
import {
  completePhase,
  createInitialState,
  durationForPhase,
  pause,
  recordInterruption,
  resetPhase,
  resetSession,
  skipPhase,
  start,
} from '@/domain/timer';
import type { TimerConfig, TimerState } from '@/domain/types';
import { useHistoryStore } from './history-store';
import { usePreferencesStore } from './preferences-store';
import { selectActiveTask, useTaskStore } from './task-store';

export interface TimerStore {
  readonly state: TimerState;
  readonly config: TimerConfig;
  /** Starts or resumes the current phase. */
  start: () => void;
  /** Pauses the current phase, freezing the remaining time. */
  pause: () => void;
  /** Toggles between running and paused. */
  toggle: () => void;
  /** Resets the current phase to its full duration. */
  reset: () => void;
  /** Resets the entire session back to the beginning. */
  resetAll: () => void;
  /** Skips to the next phase without starting it. */
  skip: () => void;
  /** Records an interruption against the phase in progress. */
  interrupt: () => void;
  /** Applies the expiry of a phase: advances and, if configured, auto-starts. */
  complete: () => void;
  /** Replaces the configuration and re-bases the current phase duration. */
  setConfig: (config: TimerConfig) => void;
  /** Restores a persisted snapshot, catching up on any phases that elapsed. */
  restore: (state: TimerState, config: TimerConfig) => void;
}

function now(): number {
  return Date.now();
}

const initialConfig = defaultConfig();

export const useTimerStore = create<TimerStore>()((set, get) => ({
  state: createInitialState(initialConfig),
  config: initialConfig,

  start: () => {
    set((store) => ({ state: start(store.state, now()) }));
  },

  pause: () => {
    set((store) => ({ state: pause(store.state, now()) }));
  },

  toggle: () => {
    set((store) => ({
      state:
        store.state.status === 'running'
          ? pause(store.state, now())
          : start(store.state, now()),
    }));
  },

  reset: () => {
    set((store) => ({ state: resetPhase(store.state, store.config) }));
  },

  resetAll: () => {
    set((store) => ({ state: resetSession(store.state, store.config) }));
  },

  skip: () => {
    set((store) => ({ state: skipPhase(store.state, store.config) }));
  },

  interrupt: () => {
    set((store) => ({ state: recordInterruption(store.state) }));
  },

  complete: () => {
    const current = get();

    // Only a running phase can complete. Completing an idle or paused
    // timer would record a session that never happened.
    if (current.state.status !== 'running') {
      return;
    }

    // The completion is computed before the state changes so that the
    // history and the task queue can be updated with it. Both are separate
    // stores, and both writes are synchronous, so no update can be lost.
    const { state, completion } = completePhase(current.state, current.config, now());

    set({ state });

    const activeTask = selectActiveTask(useTaskStore.getState());
    useHistoryStore.getState().record(completion, activeTask);

    if (completion.phase === 'work') {
      useTaskStore.getState().recordFocusSession();

      // When the active task has used up its estimate, the queue can move
      // on by itself — but only if the user asked for that behaviour.
      //
      // The task is re-read after the session was recorded, because the
      // check is against the *updated* count: a task estimated at one
      // session is only over budget once that session has been banked.
      const preferences = usePreferencesStore.getState().preferences;
      const updated = selectActiveTask(useTaskStore.getState());

      if (preferences.autoAdvanceTask && updated !== null && isOverEstimate(updated)) {
        useTaskStore.getState().advanceToNextTask();
      }
    }
  },

  setConfig: (config) => {
    set((store) => {
      const wasRunning = store.state.status === 'running';
      const endsAt = store.state.endsAt;
      const elapsed = wasRunning && endsAt !== null ? endsAt - now() : 0;

      // Re-base the current phase onto the new duration, preserving elapsed
      // time when the timer is running so a change never rewinds the clock.
      const duration = durationForPhase(store.state.phase, config);
      const remaining = wasRunning ? Math.max(0, Math.min(elapsed, duration)) : duration;

      return {
        config,
        state: {
          ...store.state,
          remaining,
          endsAt: wasRunning ? now() + remaining : endsAt,
        },
      };
    });
  },

  restore: (state, config) => {
    set({ state, config });
  },
}));

