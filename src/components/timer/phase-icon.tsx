import { Armchair, Coffee, Focus } from 'lucide-react';
import type * as React from 'react';

import type { TimerPhase } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface PhaseIconProps {
  /** The phase whose glyph is drawn. */
  readonly phase: TimerPhase;
  /** Classes for the glyph. */
  readonly className?: string;
  /**
   * Inline style for the glyph.
   *
   * It exists for the colour: the phase accents are CSS variables, and an
   * inline style is how the rest of the app reads them rather than a
   * Tailwind class per phase.
   */
  readonly style?: React.CSSProperties;
}

/**
 * The glyph for a phase.
 *
 * The three phases used to be words and nothing else, which made them slower
 * to tell apart than they should be: "Focus" and "Short break" are the same
 * shape of text at a glance. The cup is the one everybody already reads as
 * *a break*, and the chair is what makes the long break a different thing
 * from the short one rather than the same thing for longer.
 *
 * The glyphs are written out one by one rather than picked from a record and
 * rendered as a variable, because a component chosen during render is a
 * component React treats as new on every pass.
 */
export function PhaseIcon({ phase, className, style }: PhaseIconProps) {
  const classes = cn('size-3.5', className);

  switch (phase) {
    case 'work':
      return <Focus className={classes} style={style} aria-hidden="true" />;
    case 'shortBreak':
      return <Coffee className={classes} style={style} aria-hidden="true" />;
    case 'longBreak':
      return <Armchair className={classes} style={style} aria-hidden="true" />;
  }
}
