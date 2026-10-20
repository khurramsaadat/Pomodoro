import type { TimerPhase } from '@/domain/types';

/**
 * The accent colour for each phase.
 *
 * The colours live in CSS variables so the timer, the cycle indicator and
 * the mini widget all read from the same source of truth and follow the
 * light and dark themes automatically.
 */
export const PHASE_COLORS: Record<TimerPhase, string> = {
  work: 'var(--color-phase-work)',
  shortBreak: 'var(--color-phase-short)',
  longBreak: 'var(--color-phase-long)',
};

/** The accent colour for a phase. */
export function phaseColor(phase: TimerPhase): string {
  return PHASE_COLORS[phase];
}
