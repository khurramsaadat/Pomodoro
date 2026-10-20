import { advance, bankFocusTime, durationForPhase } from './timer';
import type { PhaseCompletion, TimerConfig, TimerPhase, TimerState } from './types';

/** The maximum number of phases to replay when catching up. */
const MAX_CATCH_UP_PHASES = 512;

export interface CatchUpResult {
  /** The state after replaying every phase that elapsed while away. */
  readonly state: TimerState;
  /** The phases that completed while the app was closed, in order. */
  readonly completedPhases: TimerPhase[];
  /**
   * The full record of each phase that completed while the app was closed.
   *
   * The statistics need these: a focus session that ran while the tab was
   * closed is real work and must be recorded, not silently dropped.
   */
  readonly completions: PhaseCompletion[];
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
  const completions: PhaseCompletion[] = [];
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

    // The phase ran on its original schedule, uninterrupted, so it occupied
    // exactly its configured duration.
    const durationMs = durationForPhase(completedPhase, config);
    completions.push({
      phase: completedPhase,
      startedAt: current.endsAt - durationMs,
      endedAt: current.endsAt,
      durationMs,
      interruptions: current.interruptions,
      voided: false,
    });

    // A phase that ran unattended occupies exactly its configured duration,
    // so the focus time it banks is that duration.
    const advanced =
      completedPhase === 'work' ? bankFocusTime(advance(current, config), durationMs) : advance(current, config);
    const shouldAutoStart =
      completedPhase === 'work' ? config.autoStartBreaks : config.autoStartWork;

    if (!shouldAutoStart) {
      // The original run was waiting for the user here, so it stops too.
      current = advanced;
      break;
    }

    // Continue the original schedule: the next phase's deadline is derived
    // from the previous phase's deadline, not from `now`. The phase is
    // treated as having started when the previous one ended, so the time it
    // occupied is measured correctly when it eventually completes.
    current = {
      ...advanced,
      status: 'running',
      endsAt: current.endsAt + advanced.remaining,
      startedAt: current.endsAt,
    };

    guard += 1;
  }

  return { state: current, completedPhases, completions };
}
