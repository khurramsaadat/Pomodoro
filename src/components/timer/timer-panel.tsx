import { useEffect } from 'react';

import { CycleIndicator } from '@/components/timer/cycle-indicator';
import { CountdownRing } from '@/components/timer/countdown-ring';
import { TimerControls } from '@/components/timer/timer-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cycleProgress, durationForPhase, phaseLabel, statusLabel } from '@/domain/timer';
import type { TimerPhase } from '@/domain/types';
import { usePomodoroTimer } from '@/hooks/use-pomodoro-timer';
import { unlockAudio } from '@/lib/audio';
import { formatDuration } from '@/lib/time';
import { useTimerStore } from '@/store/timer-store';

/** The accent colour for each phase, matching the CSS tokens. */
const PHASE_COLORS: Record<TimerPhase, string> = {
  work: 'var(--color-phase-work)',
  shortBreak: 'var(--color-phase-short)',
  longBreak: 'var(--color-phase-long)',
};

export interface TimerPanelProps {
  /** Called when a phase completes. */
  readonly onPhaseComplete?: ((phase: TimerPhase) => void) | undefined;
}

/**
 * The main timer surface: the countdown ring, the controls and the cycle
 * indicator.
 *
 * All of the state lives in the store; this component is responsible for
 * rendering it and for wiring up the user actions.
 */
export function TimerPanel({ onPhaseComplete }: TimerPanelProps) {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);

  const { remaining, toggle, reset, skip } = usePomodoroTimer({ onPhaseComplete });

  // Browsers only allow audio after a user gesture, so the context is
  // unlocked on the first interaction with the timer.
  useEffect(() => {
    const unlock = (): void => {
      void unlockAudio();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const duration = durationForPhase(state.phase, config);
  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const color = PHASE_COLORS[state.phase];
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
