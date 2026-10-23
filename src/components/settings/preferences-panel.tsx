import { ChevronDown, Keyboard, Settings } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { AboutDialog } from '@/components/layout/about-dialog';
import { ShortcutList } from '@/components/layout/shortcut-list';
import { AmbiencePicker } from '@/components/settings/ambience-picker';
import { BackupControls } from '@/components/settings/backup-controls';
import { SoundPicker } from '@/components/settings/sound-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  clampDailyGoal,
  clampDailyGoalMinutes,
  MAX_DAILY_GOAL,
  MAX_DAILY_GOAL_MINUTES,
  MIN_DAILY_GOAL,
  MIN_DAILY_GOAL_MINUTES,
} from '@/domain/preferences';
import { cn } from '@/lib/utils';
import { platform } from '@/platform';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';

export interface PreferencesPanelProps {
  /** Additional classes for the container. */
  readonly className?: string;
}



/**
 * The user preferences.
 *
 * These are the settings that describe how the app behaves rather than how
 * long a session runs; the session lengths live with the timer itself.
 */
export function PreferencesPanel({ className }: PreferencesPanelProps) {
  // The two destructive buttons arm before they fire: the first click marks
  // the button, the second does the work. The row is the confirmation — a
  // modal that repeats the question the button just asked is a step with
  // nothing left to decide, and the browser's own dialog is one the native
  // tier cannot style or centre.
  const [confirmingClearTasks, setConfirmingClearTasks] = useState(false);
  const [confirmingClearHistory, setConfirmingClearHistory] = useState(false);

  // The shortcut list is a reference, so it starts open: a reference nobody
  // has to unfold is one nobody misses. The chevron is the only word about
  // it — a button that also says "Expand" or "Collapse" is saying what the
  // arrow already says.
  const [shortcutsOpen, setShortcutsOpen] = useState(true);

  const preferences = usePreferencesStore((store) => store.preferences);
  const updatePreference = usePreferencesStore((store) => store.updatePreference);

  const clearHistory = useHistoryStore((store) => store.clear);
  const clearTasks = useTaskStore((store) => store.clearTasks);

  const id = useId();

  const handleClearTasks = (): void => {
    if (!preferences.confirmBeforeClearing || confirmingClearTasks) {
      clearTasks();
      setConfirmingClearTasks(false);
      setConfirmingClearHistory(false);
      return;
    }

    setConfirmingClearHistory(false);
    setConfirmingClearTasks(true);
  };

  const handleClearHistory = (): void => {
    if (!preferences.confirmBeforeClearing || confirmingClearHistory) {
      clearHistory();
      setConfirmingClearTasks(false);
      setConfirmingClearHistory(false);
      return;
    }

    setConfirmingClearTasks(false);
    setConfirmingClearHistory(true);
  };

  return (
    <Card className={cn('py-6', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="size-4" />
          Preferences
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`${id}-goal`}>Daily focus goal</Label>
              <span className="text-muted-foreground text-xs">
                {preferences.dailyGoalMode === 'minutes'
                  ? 'How many focus minutes you aim for each day.'
                  : 'How many focus sessions you aim for each day.'}
              </span>
            </div>

            {preferences.dailyGoalMode === 'minutes' ? (
              <Input
                id={`${id}-goal`}
                type="number"
                min={MIN_DAILY_GOAL_MINUTES}
                max={MAX_DAILY_GOAL_MINUTES}
                step={15}
                value={preferences.dailyGoalMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    updatePreference('dailyGoalMinutes', clampDailyGoalMinutes(value));
                  }
                }}
                className="w-20"
              />
            ) : (
              <Input
                id={`${id}-goal`}
                type="number"
                min={MIN_DAILY_GOAL}
                max={MAX_DAILY_GOAL}
                value={preferences.dailyGoal}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    updatePreference('dailyGoal', clampDailyGoal(value));
                  }
                }}
                className="w-20"
              />
            )}
          </div>

          {/*
            A goal of eight sessions treats eight sprints and eight long
            sessions as the same day, and they are not. The measured focus
            time is the honest unit, so the user chooses which one the goal
            counts.
          */}
          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label="Daily goal counts"
          >
            {(['sessions', 'minutes'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={preferences.dailyGoalMode === mode ? 'default' : 'outline'}
                aria-pressed={preferences.dailyGoalMode === mode}
                onClick={() => updatePreference('dailyGoalMode', mode)}
                className="h-7 text-xs capitalize"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-sound`} className="font-normal">
              Play a sound
            </Label>
            <span className="text-muted-foreground text-xs">
              Play a cue when a phase finishes.
            </span>
          </div>
          <Switch
            id={`${id}-sound`}
            checked={preferences.soundEnabled}
            onCheckedChange={(checked) => updatePreference('soundEnabled', checked)}
          />
        </div>

        {/*
          The picker is only shown when the sound is on: choosing a sound
          that will not be played is a setting that does nothing.
        */}
        {preferences.soundEnabled ? <SoundPicker /> : null}

        {/*
          The ambience is a *background* sound rather than a cue: it runs
          for as long as the session does, and it is stopped by the engine
          rather than by this panel — which is unmounted whenever the user
          is on another tab.
        */}
        <AmbiencePicker />

        {/*
          The ambience is *scoped*: a user who chose rain to work under did
          not necessarily choose it for the break, which is when the room
          should come back.
        */}
        {preferences.backgroundSound !== 'none' ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Play ambience during</span>
              <span className="text-muted-foreground text-xs">
                Focus only, breaks only, or both.
              </span>
            </div>

            <div
              className="flex items-center gap-1.5"
              role="radiogroup"
              aria-label="Play ambience during"
            >
              {(['focus', 'breaks', 'both'] as const).map((scope) => (
                <Button
                  key={scope}
                  type="button"
                  size="sm"
                  variant={preferences.ambienceScope === scope ? 'default' : 'outline'}
                  aria-pressed={preferences.ambienceScope === scope}
                  onClick={() => updatePreference('ambienceScope', scope)}
                  className="h-7 text-xs capitalize"
                >
                  {scope}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {/*
          The two end-of-phase notifications, and they are separate choices:
          a user may want the toast without the taskbar jumping, or the
          taskbar flash without a toast covering the screen.

          The attention request is native-only. A browser tab has no taskbar
          entry to flash, so offering the choice there would be a promise
          the browser cannot keep.
        */}
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Notifications</h3>
            <span className="text-muted-foreground text-xs">
              How the app says a phase has ended.
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`${id}-notify`} className="font-normal">
                Notify when a phase ends
              </Label>
              <span className="text-muted-foreground text-xs">
                A notification when a focus session or a break is over.
              </span>
            </div>
            <Switch
              id={`${id}-notify`}
              checked={preferences.notificationsEnabled}
              onCheckedChange={(checked) => {
                if (!checked) {
                  updatePreference('notificationsEnabled', false);
                  return;
                }

                // The browser only grants notification permission from a
                // user gesture, and this switch is one — so the question is
                // asked at the moment the preference is turned on. The
                // desktop tier needs no permission and answers at once.
                //
                // The switch follows the answer rather than the click: a
                // toggle that stays on after the browser has refused is a
                // promise the app cannot keep.
                void platform.requestNotificationPermission().then((granted) => {
                  updatePreference('notificationsEnabled', granted);

                  if (!granted) {
                    toast.error('Notifications are blocked', {
                      description: 'Allow them for this site in your browser settings.',
                    });
                  }
                });
              }}
            />
          </div>

          {platform.capabilities.supportsAttention ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`${id}-attention`} className="font-normal">
                  Flash the taskbar
                </Label>
                <span className="text-muted-foreground text-xs">
                  A gentle reminder when the window is in the background. It asks to be
                  noticed without stealing focus.
                </span>
              </div>
              <Switch
                id={`${id}-attention`}
                checked={preferences.attentionEnabled}
                onCheckedChange={(checked) => updatePreference('attentionEnabled', checked)}
              />
            </div>
          ) : null}
        </div>

        {/*
          The shortcuts are a *reference*, not a control, but they are
          listed here as well as in the header's dialog: the settings tab
          is where a user goes to find out what the app can do, and a
          shortcut that is only in a small icon in the corner is a shortcut
          most people never find.
        */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 text-left text-sm font-medium"
            aria-expanded={shortcutsOpen}
            aria-controls={`${id}-shortcuts`}
            onClick={() => setShortcutsOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <Keyboard className="text-primary size-4 shrink-0" aria-hidden="true" />
              Keyboard shortcuts
            </span>
            {/*
              One chevron that turns over, rather than two that swap places:
              a swap is a cut, and the turn is what tells the eye the thing
              below it is about to move.
            */}
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform duration-200 ease-out',
                shortcutsOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          {/*
            The list slides rather than appearing.

            The height is the *grid row*, not a measured pixel height: `0fr`
            and `1fr` are interpolated by the browser, so the panel may hold
            anything — including the global shortcut that exists only on the
            desktop tier — without a measurement that goes stale the moment
            the list changes.

            The content stays mounted while closed, which is what makes the
            slide possible; it is hidden from assistive technology instead,
            so a closed section is not read out.
          */}
          <div
            id={`${id}-shortcuts`}
            aria-hidden={!shortcutsOpen}
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
              shortcutsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              <span className="text-muted-foreground text-xs">
                The shortcuts are ignored while you are typing in a field.
              </span>

              <ShortcutList />
            </div>
          </div>
        </div>

        {/*
          The always-on-top control is native-only. A browser tab has no
          z-order, so offering the choice there would be a promise the
          browser cannot keep.
        */}
        {platform.capabilities.supportsAlwaysOnTop ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`${id}-always-on-top`} className="font-normal">
                  Keep the window on top
                </Label>
                <span className="text-muted-foreground text-xs">
                  Stay above the other windows, so the timer is never hidden.
                </span>
              </div>
              <Switch
                id={`${id}-always-on-top`}
                checked={preferences.alwaysOnTop}
                onCheckedChange={(checked) => updatePreference('alwaysOnTop', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`${id}-follow-phase`} className="font-normal">
                  Pin only while focusing
                </Label>
                <span className="text-muted-foreground text-xs">
                  Step back during a break, when you are looking at something else.
                </span>
              </div>
              <Switch
                id={`${id}-follow-phase`}
                checked={preferences.alwaysOnTopFollowsPhase}
                onCheckedChange={(checked) => updatePreference('alwaysOnTopFollowsPhase', checked)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-advance`} className="font-normal">
              Auto-advance the task
            </Label>
            <span className="text-muted-foreground text-xs">
              Move to the next open task once this one reaches its estimate.
            </span>
          </div>
          <Switch
            id={`${id}-advance`}
            checked={preferences.autoAdvanceTask}
            onCheckedChange={(checked) => updatePreference('autoAdvanceTask', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-completed`} className="font-normal">
              Show completed tasks
            </Label>
            <span className="text-muted-foreground text-xs">
              Keep finished tasks visible in the queue.
            </span>
          </div>
          <Switch
            id={`${id}-completed`}
            checked={preferences.showCompletedTasks}
            onCheckedChange={(checked) => updatePreference('showCompletedTasks', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-confirm`} className="font-normal">
              Confirm before clearing
            </Label>
            <span className="text-muted-foreground text-xs">
              Ask before deleting the history or the queue.
            </span>
          </div>
          <Switch
            id={`${id}-confirm`}
            checked={preferences.confirmBeforeClearing}
            onCheckedChange={(checked) => updatePreference('confirmBeforeClearing', checked)}
          />
        </div>

        {/*
          The five things that act on the app's data live in *one* row.
          They used to sit in two sections — backup above, the destructive
          buttons below — which made a row of five look like a scattered
          three. They belong together: all five answer *what can I do with
          what I have saved?*, and About sits with them because it is where
          the saved data lives on disk.
        */}
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Backup and data</h3>
            <span className="text-muted-foreground text-xs">
              Save everything to a file, restore it from one, or clear it away.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BackupControls />

            <Button
              variant={confirmingClearTasks ? 'destructive' : 'outline'}
              size="sm"
              aria-label="Clear task queue"
              onClick={handleClearTasks}
            >
              {confirmingClearTasks ? 'Click again to clear' : 'Clear task queue'}
            </Button>

            <Button
              variant={confirmingClearHistory ? 'destructive' : 'outline'}
              size="sm"
              aria-label="Clear history"
              onClick={handleClearHistory}
            >
              {confirmingClearHistory ? 'Click again to clear' : 'Clear history'}
            </Button>

            <AboutDialog label="About" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
