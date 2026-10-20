import { create } from 'zustand';

import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import { preferencesRepository } from '@/storage/preferences';

/**
 * The user preferences.
 *
 * The preferences are separate from the timer configuration on purpose:
 * changing the daily goal must never rewrite the user's session lengths.
 */

export interface PreferencesStore {
  readonly preferences: Preferences;
  /** Replaces the whole set of preferences. */
  setPreferences: (preferences: Preferences) => void;
  /** Updates a single preference. */
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Restores the preferences from storage. */
  restore: () => void;
}

export const usePreferencesStore = create<PreferencesStore>()((set) => ({
  preferences: DEFAULT_PREFERENCES,

  setPreferences: (preferences) => {
    set({ preferences });
  },

  updatePreference: (key, value) => {
    set((store) => ({ preferences: { ...store.preferences, [key]: value } }));
  },

  restore: () => {
    const stored = preferencesRepository.read();
    if (stored === null) {
      return;
    }
    set({ preferences: stored });
  },
}));
