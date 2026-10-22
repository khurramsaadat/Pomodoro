/**
 * The breathing rhythm.
 *
 * A focus timer that only counts down asks the user to sit still and wait.
 * A timer that *breathes* with them — the ring swelling as they inhale and
 * settling as they exhale — turns the wait into something they take part
 * in, and it costs nothing but a slow animation.
 *
 * The rhythm is defined here, in the domain, because it is a fact about the
 * app rather than about the interface: the label the user reads and the
 * animation the user watches have to agree about when the inhale ends, and
 * two independent implementations of "four seconds" would eventually
 * disagree.
 *
 * The timings are deliberately plain. Nothing here reads the clock, so the
 * whole module is a pure function of the elapsed time.
 */

/** How long the inhale lasts, in milliseconds. */
export const INHALE_MS = 4_000;

/** How long the exhale lasts, in milliseconds. */
export const EXHALE_MS = 4_000;

/** How long a whole breath takes, in milliseconds. */
export const BREATH_CYCLE_MS = INHALE_MS + EXHALE_MS;

/** Which half of the breath is being breathed. */
export type BreathPhase = 'inhale' | 'exhale';

/**
 * The half of the breath that the elapsed time falls in.
 *
 * The elapsed time is taken modulo the cycle, so the rhythm never drifts
 * and never needs a start time of its own.
 */
export function breathPhase(elapsedMs: number): BreathPhase {
  const within = ((elapsedMs % BREATH_CYCLE_MS) + BREATH_CYCLE_MS) % BREATH_CYCLE_MS;
  return within < INHALE_MS ? 'inhale' : 'exhale';
}

/**
 * How far through the current half of the breath the elapsed time is.
 *
 * The answer is from 0 to 1, and it is what the ring's scale is drawn
 * from: a ring that grows with the inhale and shrinks with the exhale is
 * the same fact as the label, said in a different way.
 */
export function breathProgress(elapsedMs: number): number {
  const within = ((elapsedMs % BREATH_CYCLE_MS) + BREATH_CYCLE_MS) % BREATH_CYCLE_MS;
  return within < INHALE_MS ? within / INHALE_MS : (within - INHALE_MS) / EXHALE_MS;
}

/** The words the user reads while they breathe. */
export function breathLabel(phase: BreathPhase): string {
  return phase === 'inhale' ? 'Breathe in' : 'Breathe out';
}

/**
 * How far the breath has swelled, from 0 (fully exhaled) to 1 (fully
 * inhaled).
 *
 * The progress through the *current half* is not what the ring needs: that
 * runs from 0 to 1 twice a cycle, so a ring drawn from it would grow
 * through the inhale and keep growing through the exhale. The swell is the
 * shape of the breath itself — it rises through the inhale and falls
 * through the exhale, so it is one number that goes up and comes back down.
 *
 * The ring is drawn from this, and the label from the phase beside it, and
 * they are the same curve read two ways.
 */
export function breathSwell(elapsedMs: number): number {
  const within = ((elapsedMs % BREATH_CYCLE_MS) + BREATH_CYCLE_MS) % BREATH_CYCLE_MS;

  if (within < INHALE_MS) {
    return within / INHALE_MS;
  }

  return 1 - (within - INHALE_MS) / EXHALE_MS;
}
