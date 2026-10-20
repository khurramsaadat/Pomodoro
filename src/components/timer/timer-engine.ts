import { createContext, useContext } from 'react';

/**
 * The timer engine, lifted out of the timer panel.
 *
 * The engine used to live inside `TimerPanel`, which is rendered inside a
 * Radix tab. Radix *unmounts* the content of an inactive tab, so the engine
 * was torn down whenever the user looked at the task queue or the
 * statistics — the countdown stopped, and a phase that expired while another
 * tab was open was not noticed until the user came back.
 *
 * Hosting the engine in a provider that is mounted once for the lifetime of
 * the app fixes both: the timer always runs, and the mini widget can show
 * the countdown without the full panel being on screen.
 *
 * The remaining time is deliberately *not* part of the engine context. It
 * changes five times a second, and putting it in the same context would
 * re-render every consumer on every tick. Consumers read it from a separate
 * context that only the countdown subscribes to.
 */

/** The actions the timer exposes to its views. */
export interface TimerEngineState {
  /** Starts or resumes the timer. */
  readonly start: () => void;
  /** Pauses the timer. */
  readonly pause: () => void;
  /** Toggles between running and paused. */
  readonly toggle: () => void;
  /** Resets the current phase. */
  readonly reset: () => void;
  /** Skips to the next phase. */
  readonly skip: () => void;
  /** Records an interruption. */
  readonly interrupt: () => void;
}

export const TimerEngineContext = createContext<TimerEngineState | null>(null);

/**
 * The remaining time, kept in its own context.
 *
 * Splitting it out means the 5 Hz countdown only re-renders the components
 * that actually display the time, rather than every consumer of the engine.
 */
export const RemainingContext = createContext<number | null>(null);

/** Reads the timer engine. Throws when used outside the provider. */
export function useTimerEngine(): TimerEngineState {
  const engine = useContext(TimerEngineContext);

  if (!engine) {
    throw new Error('useTimerEngine must be used inside a TimerEngineProvider');
  }

  return engine;
}

/**
 * Reads the remaining time. Throws when used outside the provider.
 *
 * The context's default is `null` rather than zero, because zero is a
 * legitimate remaining time — a phase that has just expired — and a default
 * of zero would make a missing provider indistinguishable from an expired
 * phase.
 */
export function useRemaining(): number {
  const remaining = useContext(RemainingContext);

  if (remaining === null) {
    throw new Error('useRemaining must be used inside a TimerEngineProvider');
  }

  return remaining;
}
