/**
 * The completion notification.
 *
 * A phase that ends is worth saying out loud — but only once, and only if
 * the user asked for it.
 *
 * **The deadline is the key.** Two independent clocks watch the same
 * deadline: the page's own tick, and the desktop tier's host alarm. Both
 * of them can notice that a deadline has passed, and both of them may fire
 * for it. The deadline is the one thing they agree on — it is the same
 * `endsAt` the countdown is drawn from — so it is what the notification is
 * de-duplicated by.
 *
 * The notification is raised through the platform bridge rather than
 * directly, because the two tiers raise it in genuinely different ways: the
 * browser through the Notification API, the desktop through the host's
 * alarm on its own thread. The app above the seam does not have to know
 * which of them it is on.
 */

import type { TimerPhase } from '@/domain/types';
import { platform } from '@/platform';

/** The deadlines whose notification has already been raised. */
const notifiedDeadlines = new Set<number>();

/** How many deadlines are remembered. */
const MAX_NOTIFIED_DEADLINES = 32;

/**
 * The text of the notification for a phase.
 *
 * It is the same wording the toast uses, so the user reads one sentence
 * rather than two different ones.
 */
export function notificationText(phase: TimerPhase): { title: string; body: string } {
  return phase === 'work'
    ? { title: 'Focus session complete', body: 'Take a break. You have earned it.' }
    : { title: 'Break over', body: 'Back to work.' };
}

/**
 * Raises the notification for a deadline that has been reached.
 *
 * The notification is raised at most once per deadline, whichever clock
 * notices it first.
 */
export function notifyCompletion(options: { phase: TimerPhase; endsAt: number }): void {
  const { phase, endsAt } = options;

  if (notifiedDeadlines.has(endsAt)) {
    return;
  }

  notifiedDeadlines.add(endsAt);

  // The oldest entry is dropped once the set is full. The set is a
  // de-duplication device rather than a record, so the order does not
  // matter; the insertion order is simply the cheapest way to find one.
  if (notifiedDeadlines.size > MAX_NOTIFIED_DEADLINES) {
    const oldest = notifiedDeadlines.values().next();
    if (!oldest.done) {
      notifiedDeadlines.delete(oldest.value);
    }
  }

  platform.showNotification(notificationText(phase));
}
