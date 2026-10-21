import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';

import { AlwaysOnTopToggle } from '@/components/layout/always-on-top-toggle';
import { AppNav } from '@/components/layout/app-nav';
import { AppShell } from '@/components/layout/app-shell';
import { Dashboard } from '@/components/layout/dashboard';
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog';
import { MiniModeToggle } from '@/components/mini/mini-mode-toggle';
import { MiniTimer } from '@/components/mini/mini-timer';
import { PreferencesPanel } from '@/components/settings/preferences-panel';
import { DailyGoal } from '@/components/stats/daily-goal';
import { HistoryList } from '@/components/stats/history-list';
import { StatsPanel } from '@/components/stats/stats-panel';
import { TaskQueue } from '@/components/tasks/task-queue';
import { WorkingOn } from '@/components/tasks/working-on';
import { SessionPlan } from '@/components/timer/session-plan';
import { SessionSummary } from '@/components/timer/session-summary';
import { TimerEngineProvider } from '@/components/timer/timer-engine-provider';
import { TimerPanel } from '@/components/timer/timer-panel';
import { TimerSettings } from '@/components/timer/timer-settings';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { dailyProgress } from '@/domain/history';
import type { TimerPhase } from '@/domain/types';
import { useMiniMode } from '@/hooks/use-mini-mode';
import { useMiniModePersistence } from '@/hooks/use-mini-mode-persistence';
import { useTimerPersistence } from '@/hooks/use-timer-persistence';
import { useWorkspacePersistence } from '@/hooks/use-workspace-persistence';
import { platform } from '@/platform';
import { useHistoryStore } from '@/store/history-store';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { selectActiveTask, selectNextTask, useTaskStore } from '@/store/task-store';

import { useTimerStore } from '@/store/timer-store';

/** A human-readable message for each phase completion. */
function completionMessage(phase: TimerPhase): string {
  return phase === 'work'
    ? 'Focus session complete — take a break.'
    : 'Break over — back to work.';
}

/** How often the daily goal re-reads the clock, in milliseconds. */
const CLOCK_INTERVAL_MS = 60_000;

/**
 * The workspaces the navigation bar offers.
 *
 * The order they are declared in is the order they are offered in, so the
 * type is the list.
 */
type Workspace = 'tasks' | 'session' | 'stats' | 'settings';

export default function App() {
  const miniEnabled = useMiniModeStore((store) => store.enabled);

  const activeTask = useTaskStore(selectActiveTask);
  const entries = useHistoryStore((store) => store.entries);
  const dailyGoal = usePreferencesStore((store) => store.preferences.dailyGoal);
  const autoAdvance = usePreferencesStore((store) => store.preferences.autoAdvanceTask);

  // The task the queue would move on to. It is read through a selector
  // that takes the preference, because the line is only shown when the
  // move is really going to happen.
  const nextTask = useTaskStore((store) => selectNextTask(store, autoAdvance));

  const timerState = useTimerStore((store) => store.state);
  const timerConfig = useTimerStore((store) => store.config);

  // The tab root owns the selection, and the "working on" strip under the
  // clock is a doorway into the queue. The selection is therefore held
  // here, as controlled state, rather than being left to the root: a
  // ref would give the DOM element and not the selection.
  const [workspace, setWorkspace] = useState<Workspace>('tasks');

  /**
   * Selects a workspace.
   *
   * The bar only ever offers the four known workspaces, but the callback
   * is typed as taking a plain string, so the value is checked rather
   * than cast: a value that is not a workspace is ignored, and the
   * current one is kept.
   */
  const selectWorkspace = (value: string): void => {
    if (value === 'tasks' || value === 'session' || value === 'stats' || value === 'settings') {
      setWorkspace(value);
    }
  };

  const openTasks = (): void => {
    setWorkspace('tasks');
  };

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

  // Tells the host whether it should present a mini window.
  useMiniMode();

  // The native tier shrinks its own window to become the mini timer, so
  // there is no room for the dashboard. The web tier draws the widget
  // inside the page, so the dashboard is hidden there instead. Either way
  // the user sees one timer and not two — a widget floating over a
  // full-size dashboard is the thing this feature exists to avoid.
  const hostOwnsTheWindow = platform.capabilities.supportsMiniWindow;
  const overlayMini = miniEnabled;

  return (
    /*
      The tab root sits *above* the shell, because the navigation bar has
      to be inside the tab root to know which tab is selected — and the
      bar is drawn at the bottom of the window, while the tab content is
      in the workspace column.

      `display: contents` makes the root a no-op for layout: its children
      are laid out as if they were the root's own children, so the shell
      still fills the window and the bar still lands at the bottom.
    */
    <Tabs value={workspace} onValueChange={selectWorkspace} className="contents">
      <AppShell
        bare={overlayMini}
        nav={<AppNav />}
        actions={
          <>
            <ShortcutsDialog />
            <AlwaysOnTopToggle />
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

          {overlayMini ? null : (
            <Dashboard
              clock={
                <div className="flex flex-col gap-3">
                  <TimerPanel />
                  <SessionSummary />

                  {/*
                    What the user is working on, directly under the clock.

                    The countdown answers *how long is left*; it does not
                    answer *on what*. The strip is the answer to the second
                    question, and it belongs where the eye already is every
                    time it looks at the time.

                    It is a button because the answer is a doorway: clicking
                    it opens the queue, which is where the answer is
                    changed.
                  */}
                  <WorkingOn
                    task={activeTask}
                    nextTask={nextTask}
                    onOpen={openTasks}
                  />
                </div>
              }
            >
              {/*
                The daily goal sits *above* the tabs, not inside one: the
                day rolls over on its own, so the answer is true whichever
                tab is open.

                The task the user is working on does *not* live here any
                more. It is under the clock, where the countdown is,
                because the two are read together: the countdown says how
                long is left, and the strip says on what.
              */}
              <DailyGoal
                sessions={progress.sessions}
                goal={progress.goal}
                met={progress.met}
              />

              {/*
                The tab *content* stays in the workspace column, and the tab
                *list* has moved to the navigation bar at the bottom of the
                window. Radix does not require the two to be siblings in
                the DOM: the context is what connects them, and the context
                is above both.
              */}
              <TabsContent value="session" className="flex flex-col gap-4">
                <TimerSettings />
              </TabsContent>

              <TabsContent value="tasks" className="flex flex-col gap-4">
                <TaskQueue />
              </TabsContent>

              {/*
                The recent sessions come *first* in this tab. The log is
                the app's only durable record of what the user actually
                did, and the statistics below it are derived from that log
                — so the thing the statistics are derived from should be
                the thing that is read first. It is also the card that
                was below the fold at laptop heights, which is where a
                record nobody can reach stops being a record.
              */}
              <TabsContent value="stats" className="flex flex-col gap-4">
                <HistoryList entries={entries} />
                <StatsPanel />
              </TabsContent>

              <TabsContent value="settings" className="flex flex-col gap-4">
                <PreferencesPanel />
              </TabsContent>

              {/*
                The plan sits *below* the tabs rather than inside one, because
                it is true whichever tab is open: it is the session the
                current configuration describes, and the user wants to know
                when the next break is due at the same time as they are
                looking at the task queue.
              */}
              <SessionPlan state={timerState} config={timerConfig} />
            </Dashboard>
          )}

          {/*
            The widget reads the shared engine, so it lives inside the
            provider. On the web tier it is drawn over the page; on the
            native tier the window itself is the widget, so the page draws
            it edge to edge and nothing else.
          */}
          {miniEnabled ? (
            <MiniTimer variant={hostOwnsTheWindow ? 'filling' : 'floating'} />
          ) : null}
        </TimerEngineProvider>

        <Toaster position="bottom-right" richColors closeButton />
      </AppShell>
    </Tabs>
  );
}

