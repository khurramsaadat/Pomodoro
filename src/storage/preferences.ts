import { normalizePreferences, type Preferences } from '@/domain/preferences';
import { createRepository, type Repository } from './repository';

/**
 * Persistence for the user preferences.
 *
 * Preferences are repaired rather than rejected: a payload with one bad
 * field still yields a usable set of preferences, because losing the whole
 * configuration over a single corrupt value would be a worse outcome for
 * the user than falling back to the default for that one field.
 */

export const PREFERENCES_STORAGE_KEY = 'pomodoro-preferences';

export const preferencesRepository: Repository<Preferences> = createRepository<Preferences>({
  key: PREFERENCES_STORAGE_KEY,
  validate: (value) => normalizePreferences(value),
});
