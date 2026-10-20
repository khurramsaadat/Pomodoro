import { create } from 'zustand';

import {
  appendEntry,
  clearHistory,
  createSessionEntry,
  type SessionEntry,
} from '@/domain/history';
import { historyRepository } from '@/storage/history';
import type { PhaseCompletion } from '@/domain/types';

/**
 * The session history.
 *
 * Every phase that reaches its deadline is recorded here. The history is
 * append-only so the statistics can always be recomputed from the log.
 */

export interface HistoryStore {
  /** The recorded sessions, most recent first. */
  readonly entries: readonly SessionEntry[];
  /** Records a completed phase against a task. */
  record: (completion: PhaseCompletion, task: { id: string; title: string } | null) => void;
  /** Removes every recorded session. */
  clear: () => void;
  /** Restores the history from storage. */
  restore: () => void;
}

let idCounter = 0;
function nextEntryId(): string {
  idCounter += 1;
  return `session-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export const useHistoryStore = create<HistoryStore>()((set) => ({
  entries: [],

  record: (completion, task) => {
    const entry = createSessionEntry(nextEntryId(), {
      phase: completion.phase,
      startedAt: completion.startedAt,
      endedAt: completion.endedAt,
      durationMs: completion.durationMs,
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? null,
      interruptions: completion.interruptions,
      voided: completion.voided,
    });

    set((store) => ({ entries: appendEntry(store.entries, entry) }));
  },

  clear: () => {
    set({ entries: clearHistory() });
  },

  restore: () => {
    const stored = historyRepository.read();
    if (stored === null) {
      return;
    }
    set({ entries: stored });
  },
}));
