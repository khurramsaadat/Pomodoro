import type * as React from 'react';

import { cn } from '@/lib/utils';

export interface CountdownRingProps {
  /** The progress through the phase, from 0 (just started) to 1 (finished). */
  readonly progress: number;
  /** The rendered diameter of the ring in pixels. */
  readonly size?: number;
  /** The thickness of the ring stroke in pixels. */
  readonly strokeWidth?: number;
  /** Classes applied to the SVG element. */
  readonly className?: string;
  /** The content placed in the middle of the ring. */
  readonly children?: React.ReactNode;
  /** The colour of the progress arc. */
  readonly color?: string;
  /** Accessible description of what the ring shows. */
  readonly label?: string;
  /**
   * How far the breath has swelled, from 0 to 1.
   *
   * The ring grows with the inhale and settles with the exhale. The swell is
   * a fraction of the ring's own size, and it is deliberately small: a ring
   * that breathed visibly would be a ring the user watched instead of a
   * ring they glanced at.
   */
  readonly breath?: number;
}

const VIEW_BOX = 100;

/**
 * How much larger the ring is at the top of the inhale, as a fraction of
 * its own size.
 */
const BREATH_SWELL = 0.035;

/**
 * A circular progress ring drawn with SVG.
 *
 * The arc is rendered with `stroke-dasharray` and a negative `stroke-dashoffset`
 * rather than by rotating an element, which keeps the animation smooth and
 * GPU-friendly. The track is drawn underneath so the ring reads as a gauge
 * even when the progress is near zero.
 */
export function CountdownRing({
  progress,
  size = 280,
  strokeWidth = 8,
  className,
  children,
  color = 'var(--color-phase-work)',
  label,
  breath = 0,
}: CountdownRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (VIEW_BOX - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const swell = Math.min(1, Math.max(0, breath));

  return (
    <div
      className="relative inline-flex w-full max-w-full items-center justify-center"
      style={{ maxWidth: size }}
    >
      <svg
        viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
        className={cn('size-full', className)}
        role="img"
        aria-label={label ?? 'Timer progress'}
        // The swell is a transform rather than a change of geometry, so the
        // browser can composite it rather than repaint the arc every frame.
        //
        // The rotation is part of the same transform rather than left to the
        // `-rotate-90` class, because an inline style replaces the class's
        // transform outright — and a ring that is not rotated draws its arc
        // from the top instead of from the side.
        style={{ transform: `rotate(-90deg) scale(${1 + swell * BREATH_SWELL})` }}
      >
        <circle
          cx={VIEW_BOX / 2}
          cy={VIEW_BOX / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={VIEW_BOX / 2}
          cy={VIEW_BOX / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-200 ease-linear"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}
