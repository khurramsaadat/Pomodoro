import { advance } from './timer';
import type { TimerConfig, TimerPhase, TimerState } from './types';

/** The maximum number of phases to replay when catching up. */
const MAX_CATCH_UP_PHASES = 512;

export interface CatchUpResult {
  /** The state after replaying every phase that elapsed while away. */
  readonly state: TimerState;
  /** The phases that completed while the app was closed, in order. */
  readonly completedPhases: TimerPhase[];
}

/**
 * Replays the phases that elapsed while the app was not running.
 *
 * A user who closes the tab and comes back an hour later should find the
 * timer in a sensible place, not stuck on a phase that expired long ago.
 * This function walks the schedule forward — using the *scheduled* end times
 * rather than the current time — so the reconstructed timeline matches what
 * would have happened had the tab stayed open.
 *
 * The walk stops as soon as a phase would not have auto-started, because at
 * that point the original run was waiting for the user, not progressing.
 */
export function catchUp(
  state: TimerState,
  config: TimerConfig,
  now: number,
): CatchUpResult {
  const completedPhases: TimerPhase[] = [];
  let current = state;
  let guard = 0;

  while (
    current.status === 'running' &&
    current.endsAt !== null &&
    now >= current.endsAt &&
    guard < MAX_CATCH_UP_PHASES
  ) {
    const completedPhase = current.phase;
    completedPhases.push(completedPhase);

    const advanced = advance(current, config);
    const shouldAutoStart =
      completedPhase === 'work' ? config.autoStartBreaks : config.autoStartWork;

    if (!shouldAutoStart) {
      // The original run was waiting for the user here, so it stops too.
      current = advanced;
      break;
    }

    // Continue the original schedule: the next phase's deadline is derived
    // from the previous phase's deadline, not from `now`.
    current = {
      ...advanced,
      status: 'running',
      endsAt: current.endsAt + advanced.remaining,
    };

    guard += 1;
  }

  return { state: current, completedPhases };
}
