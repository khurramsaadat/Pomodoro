import { useMemo } from 'react';
import { Circle, Coffee, Leaf } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { durationForPhase, nextPhase } from '@/domain/timer';
import type { TimerConfig, TimerPhase, TimerState } from '@/domain/types';
import { phaseColor } from '@/lib/phase';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

export interface SessionPlanProps {
  /** The timer's current state. */
  readonly state: TimerState;
  /** The timer's configuration. */
  readonly config: TimerConfig;
  /** Additional classes for the container. */
  readonly className?: string;
}

/** How many phases of the plan are shown. */
const VISIBLE_PHASES = 6;

/** The icon that stands for a phase. */
function phaseIcon(phase: TimerPhase): typeof Leaf {
  switch (phase) {
    case 'work':
      return Leaf;
    case 'shortBreak':
      return Coffee;
    case 'longBreak':
      return Leaf;
  }
}

/** The name of a phase, in the words the user sees. */
function phaseName(phase: TimerPhase): string {
  switch (phase) {
    case 'work':
      return 'Focus';
    case 'shortBreak':
      return 'Short break';
    case 'longBreak':
      return 'Long break';
  }
}

/**
 * What the rest of the session looks like.
 *
 * The dashboard had a great deal of empty space under the workspace, and
 * filling it with a plan rather than with padding is the better answer: a
 * Pomodoro user wants to know when the next break is due and how far away
 * the long break is, and that information was nowhere on the screen.
 *
 * The plan is *derived* from the configuration and the current state, so it
 * is always true — it is not a schedule the user has to keep in step.
 */
export function SessionPlan({ state, config, className }: SessionPlanProps) {
  const phases = useMemo(() => {
    const plan: { phase: TimerPhase; durationMs: number; current: boolean }[] = [];

    let phase = state.phase;
    let completed = state.completedWorkSessions;

    for (let index = 0; index < VISIBLE_PHASES; index += 1) {
      const durationMs = durationForPhase(phase, config);

      plan.push({ phase, durationMs, current: index === 0 });

      // The break that follows a set of focus sessions is a long one, and
      // the count that decides it is the number completed *including* the
      // session that just finished.
      if (phase === 'work') {
        completed += 1;
        phase = nextPhase('work', completed, config);
      } else {
        phase = 'work';
      }
    }

    return plan;
  }, [config, state.completedWorkSessions, state.phase]);

  const focusSessions = phases.filter((entry) => entry.phase === 'work').length;
  const totalMs = phases.reduce((total, entry) => total + entry.durationMs, 0);

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Up next</span>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {focusSessions} sessions · {formatDuration(totalMs)} total
          </span>
        </div>

        <ol className="flex flex-col gap-1.5">
          {phases.map((entry, index) => {
            const Icon = phaseIcon(entry.phase);
            const color = phaseColor(entry.phase);

            return (
              <li
                key={`${entry.phase}-${index}`}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-1.5 py-1 text-xs',
                  entry.current && 'bg-accent/60',
                )}
              >
                <Icon
                  className="size-3.5 shrink-0"
                  style={{ color }}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    entry.current ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {phaseName(entry.phase)}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatDuration(entry.durationMs)}
                </span>
                {entry.current ? (
                  <Circle
                    className="size-2 shrink-0 fill-current"
                    style={{ color }}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
