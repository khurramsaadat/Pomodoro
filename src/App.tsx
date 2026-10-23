import { useEffect, useRef, useState } from 'react';
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
import { SessionSummary } from '@/components/timer/session-summary';
import { TimerEngineProvider } from '@/components/timer/timer-engine-provider';
import { TimerPanel } from '@/components/timer/timer-panel';
import { TimerSettings } from '@/components/timer/timer-settings';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { dailyGoalProgress } from '@/domain/history';
import type { TimerPhase } from '@/domain/types';
import { notificationText } from '@/lib/notify';
import { useMiniMode } from '@/hooks/use-mini-mode';
import { useMiniModePersistence } from '@/hooks/use-mini-mode-persistence';
import { useTimerPersistence } from '@/hooks/use-timer-persistence';
import { useWorkspacePersistence } from '@/hooks/use-workspace-persistence';
import { platform } from '@/platform';
import { useHistoryStore } from '@/store/history-store';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { usePreferencesStore } from '@/store/preferences-store';

/** How often the daily goal re-reads the clock, in milliseconds. */
const CLOCK_INTERVAL_MS = 60_000;

/**
 * The workspaces the navigation bar offers.
 *
 * The order they are declared in is the order they are offered in, so the
 * type is the list.
 */
type Workspace = 'tasks' | 'stats' | 'settings';

export default function App() {
  const miniEnabled = useMiniModeStore((store) => store.enabled);

  const entries = useHistoryStore((store) => store.entries);
  const dailyGoal = usePreferencesStore((store) => store.preferences.dailyGoal);
  const dailyGoalMode = usePreferencesStore((store) => store.preferences.dailyGoalMode);
  const dailyGoalMinutes = usePreferencesStore((store) => store.preferences.dailyGoalMinutes);

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
    if (value === 'tasks' || value === 'stats' || value === 'settings') {
      setWorkspace(value);
    }
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

  // The goal is measured against today's sessions or today's measured focus
  // minutes, whichever the user chose. It is derived rather than kept in
  // state, so it rolls over on its own when the day does.
  const progress = dailyGoalProgress(
    entries,
    { mode: dailyGoalMode, sessionsGoal: dailyGoal, minutesGoal: dailyGoalMinutes },
    now,
  );

  // The goal is announced the moment it is *reached*, never on opening the
  // app on a day that has already met it. The previous value lives in a ref
  // rather than in state, so a goal that is merely still met is a fact and
  // stays quiet, while a goal crossed mid-session is an achievement and says
  // so. The day rolling over resets the old value, so tomorrow can earn its
  // own announcement.
  const goalWasMet = useRef(progress.met);
  useEffect(() => {
    if (progress.met && !goalWasMet.current) {
      toast.success('Daily goal reached', {
        description:
          dailyGoalMode === 'minutes'
            ? `${progress.goal} minutes of focus today.`
            : `${progress.goal} focus session${progress.goal === 1 ? '' : 's'} today.`,
      });
    }
    goalWasMet.current = progress.met;
  }, [progress.met, progress.goal, dailyGoalMode]);

  const handlePhaseComplete = (phase: TimerPhase): void => {
    const text = notificationText(phase);
    toast.success(text.title, {
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
                </div>
              }
            >
              {/*
                The tab *content* stays in the workspace column, and the tab
                *list* has moved to the navigation bar at the bottom of the
                window. Radix does not require the two to be siblings in
                the DOM: the context is what connects them, and the context
                is above both.
              */}
              <TabsContent value="tasks" className="flex flex-col gap-4">
                <TaskQueue />

                {/*
                  The queue comes first and the goal second.

                  The queue is *what* the user is working on and the goal is
                  *how far* they have got, so the second answers a question
                  about the first. Putting the progress bar above the work
                  would answer "how far have I got?" before the user has
                  been told "doing what?".
                */}
                <DailyGoal
                  sessions={progress.sessions}
                  focusMs={progress.focusMs}
                  goal={progress.goal}
                  mode={progress.mode}
                  met={progress.met}
                />
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
                {/*
                  The session settings live here rather than in a workspace
                  of their own. A fourth tab for a single card was a
                  destination the user had to learn in order to find a
                  setting, and the settings tab is where they already go
                  looking for it.

                  They come *first* in the tab, because the session lengths
                  are the settings that change what the app does, and the
                  sound that follows is a preference about how it says so.
                */}
                <TimerSettings />
                <PreferencesPanel />
              </TabsContent>
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

