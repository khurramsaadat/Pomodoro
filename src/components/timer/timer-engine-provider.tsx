import { useEffect, useMemo, type ReactNode } from 'react';

import {
  RemainingContext,
  TimerEngineContext,
  type TimerEngineState,
} from '@/components/timer/timer-engine';
import { usePomodoroTimer } from '@/hooks/use-pomodoro-timer';
import { unlockAudio } from '@/lib/audio';
import type { TimerPhase } from '@/domain/types';

export interface TimerEngineProviderProps {
  children: ReactNode;
  /** Called when a phase reaches its deadline. */
  readonly onPhaseComplete?: ((phase: TimerPhase) => void) | undefined;
}

export function TimerEngineProvider({ children, onPhaseComplete }: TimerEngineProviderProps) {
  const { remaining, start, pause, toggle, reset, skip, interrupt } = usePomodoroTimer({
    onPhaseComplete,
  });

  // Browsers only allow audio after a user gesture, so the context is
  // unlocked on the first interaction. This lives with the engine rather
  // than with the panel, because the panel is unmounted whenever the user
  // is on another tab — and the mini widget is exactly the case where the
  // user never visits the Focus tab at all.
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

  const engine = useMemo<TimerEngineState>(
    () => ({ start, pause, toggle, reset, skip, interrupt }),
    [start, pause, toggle, reset, skip, interrupt],
  );

  return (
    <TimerEngineContext.Provider value={engine}>
      <RemainingContext.Provider value={remaining}>{children}</RemainingContext.Provider>
    </TimerEngineContext.Provider>
  );
}
