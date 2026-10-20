import { Toaster, toast } from 'sonner';
import { BarChart3, ListTodo, Settings2, Timer } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { MiniModeToggle } from '@/components/mini/mini-mode-toggle';
import { MiniTimer } from '@/components/mini/mini-timer';
import { PreferencesPanel } from '@/components/settings/preferences-panel';
import { StatsPanel } from '@/components/stats/stats-panel';
import { TaskQueue } from '@/components/tasks/task-queue';
import { SessionSummary } from '@/components/timer/session-summary';
import { TimerEngineProvider } from '@/components/timer/timer-engine-provider';
import { TimerPanel } from '@/components/timer/timer-panel';
import { TimerSettings } from '@/components/timer/timer-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TimerPhase } from '@/domain/types';
import { useMiniModePersistence } from '@/hooks/use-mini-mode-persistence';
import { useTimerPersistence } from '@/hooks/use-timer-persistence';
import { useWorkspacePersistence } from '@/hooks/use-workspace-persistence';
import { useMiniModeStore } from '@/store/mini-mode-store';

/** A human-readable message for each phase completion. */
function completionMessage(phase: TimerPhase): string {
  return phase === 'work'
    ? 'Focus session complete — take a break.'
    : 'Break over — back to work.';
}

export default function App() {
  const miniEnabled = useMiniModeStore((store) => store.enabled);

  const handlePhaseComplete = (phase: TimerPhase): void => {
    toast.success(completionMessage(phase), {
      description:
        phase === 'work' ? 'Nice work. Stand up and stretch.' : 'Ready for the next session?',
    });
  };

  // Restores and persists the task queue, the history and the preferences.
  // This runs first so that the history is in place before the timer's
  // catch-up records the phases that elapsed while the app was closed.
  useWorkspacePersistence();

  // Restores the timer on load and keeps it persisted as it runs.
  useTimerPersistence({
    onRestored: (phases) => {
      toast('Welcome back', {
        description: `${phases.length} phase${phases.length === 1 ? '' : 's'} completed while you were away.`,
      });
    },
  });

  // Restores and persists the mini timer's visibility and position.
  useMiniModePersistence();

  return (
    <AppShell actions={<MiniModeToggle />}>
      {/*
        The engine sits above the tabs on purpose. Radix unmounts the
        content of an inactive tab, so hosting it inside the Focus panel
        would stop the countdown whenever the user looked at the task
        queue — and the mini widget would have nothing to show.
      */}
      <TimerEngineProvider onPhaseComplete={handlePhaseComplete}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <h1 className="sr-only">Pomodoro timer</h1>

          <Tabs defaultValue="focus">
            <TabsList className="w-full">
              <TabsTrigger value="focus">
                <Timer />
                Focus
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <ListTodo />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 />
                Stats
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings2 />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="focus" className="flex flex-col gap-4">
              <TimerPanel />
              <SessionSummary />
              <TimerSettings />
            </TabsContent>

            <TabsContent value="tasks" className="flex flex-col gap-4">
              <TaskQueue />
            </TabsContent>

            <TabsContent value="stats" className="flex flex-col gap-4">
              <StatsPanel />
            </TabsContent>

            <TabsContent value="settings" className="flex flex-col gap-4">
              <PreferencesPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* The widget reads the shared engine, so it lives inside the provider. */}
        {miniEnabled ? <MiniTimer /> : null}
      </TimerEngineProvider>

      <Toaster position="bottom-right" richColors closeButton />
    </AppShell>
  );
}

