import { CycleIndicator } from '@/components/timer/cycle-indicator';
import { CountdownRing } from '@/components/timer/countdown-ring';
import { TimerControls } from '@/components/timer/timer-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRemaining, useTimerEngine } from '@/components/timer/timer-engine';
import { breathLabel } from '@/domain/breathing';
import { cycleProgress, durationForPhase, phaseLabel, statusLabel } from '@/domain/timer';
import { useBreathing } from '@/hooks/use-reduced-motion';
import { phaseColor } from '@/lib/phase';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useTimerStore } from '@/store/timer-store';

export interface TimerPanelProps {
  /** Additional classes for the card. */
  readonly className?: string;
}

/**
 * The main timer surface: the countdown ring, the controls and the cycle
 * indicator.
 *
 * The engine itself lives in `TimerEngineProvider`, above the tabs, so that
 * the countdown keeps running while the user is on another tab. This
 * component is only the *view* of it.
 */
export function TimerPanel({ className }: TimerPanelProps) {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);

  const remaining = useRemaining();
  const { toggle, reset, skip } = useTimerEngine();

  const duration = durationForPhase(state.phase, config);
  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const color = phaseColor(state.phase);
  const cycle = cycleProgress(state, config);

  // The breath is read from the *phase's* elapsed time — the banked time
  // plus the segment being served now — so the rhythm starts with the
  // session rather than at some arbitrary moment. It breathes only while
  // the countdown is actually running: a paused timer holds its breath
  // rather than swelling at the user.
  const elapsedMs =
    state.status === 'running' ? state.elapsedMs + Math.max(0, duration - remaining) : state.elapsedMs;
  const { swell, phase: breath } = useBreathing(elapsedMs, state.status === 'running');

  // The ring's description carries the rhythm as well as the progress, so a
  // user who cannot see the swell is told which half of the breath the
  // session is in. It is only named while the timer runs: a paused timer is
  // not breathing, so saying so would be a description of nothing.
  const ringLabel =
    state.status === 'running'
      ? `${phaseLabel(state.phase)} progress — ${breathLabel(breath).toLowerCase()}`
      : `${phaseLabel(state.phase)} progress`;

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="flex flex-col items-center gap-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant="secondary"
            className="px-2.5 py-1 text-xs font-medium"
            style={{ color }}
            data-testid="timer-phase"
          >
            {phaseLabel(state.phase)}
          </Badge>
          <span className="text-muted-foreground text-xs">{statusLabel(state.status)}</span>
        </div>

        <CountdownRing
          progress={progress}
          size={240}
          color={color}
          breath={swell}
          label={ringLabel}
        >
          <div
            className="tabular-nums text-4xl leading-none font-semibold tracking-tight sm:text-5xl"
            aria-live="off"
            data-testid="timer-countdown"
          >
            {formatDuration(remaining)}
          </div>
          <span className="text-muted-foreground mt-2 text-xs">
            {formatDuration(duration)} total
          </span>
        </CountdownRing>

        <TimerControls
          status={state.status}
          onToggle={toggle}
          onReset={reset}
          onSkip={skip}
          accentColor={color}
        />

        <CycleIndicator total={cycle.total} completed={cycle.completed} color={color} />
      </CardContent>
    </Card>
  );
}
