import { validateHistory, type SessionEntry } from '@/domain/history';
import { createRepository, type Repository } from './repository';

/**
 * Persistence for the session history.
 *
 * The history is the user's record of what they actually did, so validation
 * is strict: an entry that does not describe a real phase is dropped rather
 * than patched, because a silently mis-stated duration would corrupt the
 * statistics. The validation itself lives in the domain, because an
 * imported backup has to be checked by exactly the same rules.
 */

export const HISTORY_STORAGE_KEY = 'pomodoro-history';

/** The repository that owns the session history. */
export const historyRepository: Repository<readonly SessionEntry[]> =
  createRepository<readonly SessionEntry[]>({
    key: HISTORY_STORAGE_KEY,
    validate: validateHistory,
  });
