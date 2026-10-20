import { CycleIndicator } from '@/components/timer/cycle-indicator';
import { CountdownRing } from '@/components/timer/countdown-ring';
import { TimerControls } from '@/components/timer/timer-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cycleProgress, durationForPhase, phaseLabel, statusLabel } from '@/domain/timer';
import { useRemaining, useTimerEngine } from '@/components/timer/timer-engine';
import { phaseColor } from '@/lib/phase';
import { formatDuration } from '@/lib/time';
import { useTimerStore } from '@/store/timer-store';

/**
 * The main timer surface: the countdown ring, the controls and the cycle
 * indicator.
 *
 * The engine itself lives in `TimerEngineProvider`, above the tabs, so that
 * the countdown keeps running while the user is on another tab. This
 * component is only the *view* of it.
 */
export function TimerPanel() {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);

  const remaining = useRemaining();
  const { toggle, reset, skip } = useTimerEngine();

  const duration = durationForPhase(state.phase, config);
  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const color = phaseColor(state.phase);
  const cycle = cycleProgress(state, config);

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardContent className="flex flex-col items-center gap-7 px-6 py-8 sm:px-8">
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

        <CountdownRing progress={progress} size={300} color={color}>
          <div
            className="tabular-nums text-6xl leading-none font-semibold tracking-tight sm:text-7xl"
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
