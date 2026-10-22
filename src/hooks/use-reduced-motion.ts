import { useEffect, useState } from 'react';

import { breathPhase, breathSwell, type BreathPhase } from '@/domain/breathing';

/** The query that asks whether the user has asked for less motion. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the user has asked the system for less motion.
 *
 * The stylesheet already neutralises animations and transitions under
 * `prefers-reduced-motion`, but that only covers *declarative* motion. A
 * component that moves something in response to a changing value has to ask
 * the question itself, because there is no declaration for it to neutralise.
 *
 * The question is asked once and then watched, so a user who turns the
 * setting on while the app is open is obeyed from that moment on rather than
 * at the next reload.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };

    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}

/**
 * How often the breathing animation is redrawn, in milliseconds.
 *
 * A breath lasts eight seconds, so a redraw four times a second is already
 * far finer than the eye can resolve a swell of a couple of per cent. It is
 * a `requestAnimationFrame` rather than an interval, so the motion is drawn
 * on the same clock as the rest of the page and stops with it.
 */
const BREATH_FRAME_MS = 250;

/**
 * The breathing animation: a swell that rises and falls, once a cycle.
 *
 * **The animation is decorative, so it is offered rather than imposed.**
 * A slow swell is a help to somebody who is settling into a session, and it
 * is an extra moving thing to somebody who is not. The user asks for less
 * motion in the operating system, and that setting is honoured here as
 * strongly as the stylesheet honours it.
 *
 * The hook returns the swell from 0 to 1 and the half of the breath it is
 * in, and it reads the *phase's* elapsed time rather than the wall clock, so
 * the breath starts with the session rather than at some arbitrary moment.
 */
export function useBreathing(elapsedMs: number, enabled: boolean): {
  readonly swell: number;
  readonly phase: BreathPhase;
} {
  const reduced = useReducedMotion();

  const active = enabled && !reduced;

  const [swell, setSwell] = useState(() => (active ? breathSwell(elapsedMs) : 0));
  const [phase, setPhase] = useState<BreathPhase>(() => breathPhase(elapsedMs));

  useEffect(() => {
    if (!active) {
      return;
    }

    let frame = 0;
    let last = 0;

    const draw = (timestamp: number): void => {
      // The redraw is rate-limited rather than run on every frame, because
      // a swell of a couple of per cent does not need sixty frames a
      // second, and the timer re-renders five times a second already.
      if (timestamp - last >= BREATH_FRAME_MS) {
        last = timestamp;
        setSwell(breathSwell(elapsedMs));
        setPhase(breathPhase(elapsedMs));
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [elapsedMs, active]);

  // The swell is reported as zero rather than written to state when the
  // animation is off: a paused timer holds its breath, and it does so
  // without an effect that renders a second time to say nothing has moved.
  return { swell: active ? swell : 0, phase };
}
