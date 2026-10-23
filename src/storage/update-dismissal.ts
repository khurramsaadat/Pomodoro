import { createRepository } from './repository';

/**
 * The update notice, and the dismissal of it.
 *
 * The user may dismiss a notice they have read, and the dismissal has to
 * outlive the page: a notice that reappears on every start-up is a notice
 * the user will learn to ignore. It is remembered *by version* rather than
 * as a flag, because the notice for 0.3.0 is a different notice from the
 * one for 0.2.0: dismissing the first must not silence the second.
 */

/** The storage key the dismissal is kept under. */
export const UPDATE_DISMISSED_KEY = 'pomodoro.update-dismissed';

/** The version whose notice the user has dismissed, or `null`. */
export type DismissedUpdate = string | null;

/** Reads and writes the dismissed version. */
export const updateDismissalRepository = createRepository<DismissedUpdate>({
  key: UPDATE_DISMISSED_KEY,
  // A version that is not a version is discarded, so a corrupt payload can
  // never silence the notice for a version the user has not seen.
  validate: (value) =>
    typeof value === 'string' && value.length > 0 && value.length <= 32 ? value : null,
});
