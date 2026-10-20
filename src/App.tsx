import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { BarChart3, ListTodo, Settings2, Timer } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { Dashboard } from '@/components/layout/dashboard';
import { NativeActions } from '@/components/layout/native-actions';
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog';
import { MiniModeToggle } from '@/components/mini/mini-mode-toggle';
import { MiniTimer } from '@/components/mini/mini-timer';
import { PreferencesPanel } from '@/components/settings/preferences-panel';
import { DailyGoal } from '@/components/stats/daily-goal';
import { HistoryList } from '@/components/stats/history-list';
import { StatsPanel } from '@/components/stats/stats-panel';
import { ActiveTask } from '@/components/tasks/active-task';
import { TaskQueue } from '@/components/tasks/task-queue';
import { SessionSummary } from '@/components/timer/session-summary';
import { TimerEngineProvider } from '@/components/timer/timer-engine-provider';
import { TimerPanel } from '@/components/timer/timer-panel';
import { TimerSettings } from '@/components/timer/timer-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dailyProgress } from '@/domain/history';
import type { TimerPhase } from '@/domain/types';
import { useMiniModePersistence } from '@/hooks/use-mini-mode-persistence';
import { useTimerPersistence } from '@/hooks/use-timer-persistence';
import { useWorkspacePersistence } from '@/hooks/use-workspace-persistence';
import { useHistoryStore } from '@/store/history-store';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { selectActiveTask, useTaskStore } from '@/store/task-store';

/** A human-readable message for each phase completion. */
function completionMessage(phase: TimerPhase): string {
  return phase === 'work'
    ? 'Focus session complete — take a break.'
    : 'Break over — back to work.';
}

/** How often the daily goal re-reads the clock, in milliseconds. */
const CLOCK_INTERVAL_MS = 60_000;

export default function App() {
  const miniEnabled = useMiniModeStore((store) => store.enabled);

  const activeTask = useTaskStore(selectActiveTask);
  const entries = useHistoryStore((store) => store.entries);
  const dailyGoal = usePreferencesStore((store) => store.preferences.dailyGoal);

  // The clock lives in state rather than being read during render, so the
  // component stays a pure function of its state. It ticks once a minute,
  // which is enough to notice the day rolling over.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // The goal is measured against today's sessions. It is derived rather
  // than kept in state, so it rolls over on its own when the day does.
  const progress = dailyProgress(entries, dailyGoal, now);

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
    <AppShell
      actions={
        <>
          <ShortcutsDialog />
          <NativeActions />
          <MiniModeToggle />
        </>
      }
    >
      {/*
        The engine sits above the tabs on purpose. Radix unmounts the
        content of an inactive tab, so hosting it inside the Focus panel
        would stop the countdown whenever the user looked at the task
        queue — and the mini widget would have nothing to show.
      */}
      <TimerEngineProvider onPhaseComplete={handlePhaseComplete}>
        <h1 className="sr-only">Pomodoro timer</h1>

        <Dashboard
          clock={
            <div className="flex flex-col gap-4">
              <TimerPanel />
              <SessionSummary />
              <ActiveTask task={activeTask} />
              <DailyGoal
                sessions={progress.sessions}
                goal={progress.goal}
                met={progress.met}
              />
            </div>
          }
        >
          <Tabs defaultValue="session">
            <TabsList className="w-full">
              <TabsTrigger value="session">
                <Timer />
                Session
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

            <TabsContent value="session" className="flex flex-col gap-4">
              <TimerSettings />
            </TabsContent>

            <TabsContent value="tasks" className="flex flex-col gap-4">
              <TaskQueue />
            </TabsContent>

            <TabsContent value="stats" className="flex flex-col gap-4">
              <StatsPanel />
              <HistoryList entries={entries} />
            </TabsContent>

            <TabsContent value="settings" className="flex flex-col gap-4">
              <PreferencesPanel />
            </TabsContent>
          </Tabs>
        </Dashboard>

        {/* The widget reads the shared engine, so it lives inside the provider. */}
        {miniEnabled ? <MiniTimer /> : null}
      </TimerEngineProvider>

      <Toaster position="bottom-right" richColors closeButton />
    </AppShell>
  );
}

