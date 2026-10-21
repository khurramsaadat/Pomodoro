import { useEffect, useMemo, type ReactNode } from 'react';

import {
  RemainingContext,
  TimerEngineContext,
  type TimerEngineState,
} from '@/components/timer/timer-engine';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useCompletionSound } from '@/hooks/use-completion-sound';
import { usePlatform } from '@/hooks/use-platform';
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

  // The shortcuts live with the engine rather than with the panel, because
  // the panel is unmounted whenever the user is on another tab — and a
  // shortcut that only worked on one tab would be worse than none.
  useKeyboardShortcuts({ toggle, skip, reset });

  // The native tier's alarm, tray and global shortcut live here too, for
  // the same reason: they are all about the timer, and the engine is the
  // one thing that never goes away.
  usePlatform();

  // Browsers only allow audio after a user gesture, so the context is
  // unlocked on the first interaction. This lives with the engine rather
  // than with the panel, because the panel is unmounted whenever the user
  // is on another tab — and the mini widget is exactly the case where the
  // user never visits the Focus tab at all.
  //
  // Both gestures are listened for, and *neither* is removed until one of
  // them fires, so the context is unlocked by whichever the user happens
  // to do first. The old code used `once: true` on both, which left the
  // other listener registered for the lifetime of the app.
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

  // The completion cue, and the desktop tier's alarm in step with it.
  //
  // It lives with the engine for the same reason the shortcuts do: the
  // engine is the one thing that never goes away, and a cue that only
  // worked on one tab would be worse than none.
  useCompletionSound();

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
