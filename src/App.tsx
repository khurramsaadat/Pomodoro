import { Toaster, toast } from 'sonner';

import { AppShell } from '@/components/layout/app-shell';
import { SessionSummary } from '@/components/timer/session-summary';
import { TimerPanel } from '@/components/timer/timer-panel';
import { TimerSettings } from '@/components/timer/timer-settings';
import type { TimerPhase } from '@/domain/types';
import { useTimerPersistence } from '@/hooks/use-timer-persistence';

/** A human-readable message for each phase completion. */
function completionMessage(phase: TimerPhase): string {
  return phase === 'work'
    ? 'Focus session complete — take a break.'
    : 'Break over — back to work.';
}

export default function App() {
  const handlePhaseComplete = (phase: TimerPhase): void => {
    toast.success(completionMessage(phase), {
      description:
        phase === 'work' ? 'Nice work. Stand up and stretch.' : 'Ready for the next session?',
    });
  };

  // Restores the timer on load and keeps it persisted as it runs.
  useTimerPersistence({
    onRestored: (phases) => {
      toast('Welcome back', {
        description: `${phases.length} phase${phases.length === 1 ? '' : 's'} completed while you were away.`,
      });
    },
  });

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="sr-only">Pomodoro timer</h1>
        <TimerPanel onPhaseComplete={handlePhaseComplete} />
        <SessionSummary />
        <TimerSettings />
      </div>

      <Toaster position="bottom-right" richColors closeButton />
    </AppShell>
  );
}

