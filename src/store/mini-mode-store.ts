import { create } from 'zustand';

import { DEFAULT_MINI_POSITION, type MiniPosition } from '@/domain/mini-mode';
import { miniModeRepository } from '@/storage/mini-mode';

/**
 * The mini timer's state.
 *
 * The widget is a floating view of the same timer, so it reads the timer
 * store directly rather than keeping a copy of the countdown — there is only
 * ever one timer, and two copies of its state would drift.
 */

export interface MiniModeStore {
  /** Whether the mini timer is shown. */
  readonly enabled: boolean;
  /** Where the mini timer is anchored. */
  readonly position: MiniPosition;
  /** Whether the stored layout has been read yet. */
  readonly hydrated: boolean;
  /** Shows or hides the mini timer. */
  setEnabled: (enabled: boolean) => void;
  /** Moves the mini timer. */
  setPosition: (position: MiniPosition) => void;
  /** Restores the layout from storage. */
  restore: () => void;
}

export const useMiniModeStore = create<MiniModeStore>()((set) => ({
  enabled: false,
  position: DEFAULT_MINI_POSITION,
  hydrated: false,

  setEnabled: (enabled) => {
    set({ enabled });
  },

  setPosition: (position) => {
    set({ position });
  },

  restore: () => {
    const stored = miniModeRepository.read();

    set({
      enabled: stored?.enabled ?? false,
      position: stored?.position ?? DEFAULT_MINI_POSITION,
      hydrated: true,
    });
  },
}));
