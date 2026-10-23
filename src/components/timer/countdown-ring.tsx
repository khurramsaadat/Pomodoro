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
  /**
   * Whether the dial carries hour marks.
   *
   * The marks are what make the circle read as a *clock* rather than as a
   * progress bar that happens to be round: twelve long marks at the hours
   * and four short ones between each pair, drawn inside the track so they
   * never fight the arc for the same pixels.
   */
  readonly ticks?: boolean;
}

const VIEW_BOX = 100;

/**
 * How much larger the ring is at the top of the inhale, as a fraction of
 * its own size.
 */
const BREATH_SWELL = 0.05;

/** The number of marks around the dial: one per minute of an hour. */
const TICK_COUNT = 60;

/** Every fifth mark is an hour mark and is drawn longer. */
const MAJOR_EVERY = 5;

/** How far a mark reaches in from the inside of the track, in viewBox units. */
const MAJOR_TICK_LENGTH = 4.5;
const MINOR_TICK_LENGTH = 2.4;

/** One mark on the dial, in viewBox coordinates. */
interface Tick {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly major: boolean;
}

/**
 * The hour and minute marks, laid out around the inside of the track.
 *
 * The angles are offset by a quarter turn so the first mark sits at twelve
 * o'clock. The arc is rotated by CSS instead, and the two rotations are
 * deliberately independent: the arc's rotation is what makes progress start
 * at the top, and the marks' is what makes them a clock face rather than a
 * ring of dots starting at three o'clock.
 */
function clockTicks(radius: number, strokeWidth: number): Tick[] {
  const outer = radius - strokeWidth / 2 - 1.5;
  const centre = VIEW_BOX / 2;
  const ticks: Tick[] = [];

  for (let index = 0; index < TICK_COUNT; index += 1) {
    const major = index % MAJOR_EVERY === 0;
    const angle = ((index * 360) / TICK_COUNT - 90) * (Math.PI / 180);
    const inner = outer - (major ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH);

    ticks.push({
      x1: centre + Math.cos(angle) * inner,
      y1: centre + Math.sin(angle) * inner,
      x2: centre + Math.cos(angle) * outer,
      y2: centre + Math.sin(angle) * outer,
      major,
    });
  }

  return ticks;
}

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
  size = 320,
  strokeWidth = 6,
  className,
  children,
  color = 'var(--color-phase-work)',
  label,
  breath = 0,
  ticks = true,
}: CountdownRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (VIEW_BOX - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const swell = Math.min(1, Math.max(0, breath));
  const marks = ticks ? clockTicks(radius, strokeWidth) : [];

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

        {/*
          The hour marks sit inside the track, under the arc: they are part
          of the dial rather than of the progress, so the arc passes over
          them without ever hiding one.
        */}
        {marks.map((mark, index) => (
          <line
            key={index}
            x1={mark.x1}
            y1={mark.y1}
            x2={mark.x2}
            y2={mark.y2}
            stroke="var(--color-border)"
            strokeWidth={mark.major ? 1.1 : 0.5}
            strokeLinecap="round"
            opacity={mark.major ? 0.95 : 0.6}
          />
        ))}

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
