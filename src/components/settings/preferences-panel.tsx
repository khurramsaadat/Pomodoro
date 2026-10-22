import { useId } from 'react';
import { toast } from 'sonner';
import { Keyboard, Settings } from 'lucide-react';

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
import { clampDailyGoal, MAX_DAILY_GOAL, MIN_DAILY_GOAL } from '@/domain/preferences';
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
  const preferences = usePreferencesStore((store) => store.preferences);
  const updatePreference = usePreferencesStore((store) => store.updatePreference);

  const clearHistory = useHistoryStore((store) => store.clear);
  const clearTasks = useTaskStore((store) => store.clearTasks);

  const id = useId();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="size-4" />
          Preferences
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-goal`}>Daily focus goal</Label>
            <span className="text-muted-foreground text-xs">
              How many focus sessions you aim for each day.
            </span>
          </div>
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
          <div className="flex flex-col gap-0.5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Keyboard className="size-3.5" aria-hidden="true" />
              Keyboard shortcuts
            </h3>
            <span className="text-muted-foreground text-xs">
              The shortcuts are ignored while you are typing in a field.
            </span>
          </div>

          <ShortcutList />
        </div>

        {/*
          The always-on-top control is native-only. A browser tab has no
          z-order, so offering the choice there would be a promise the
          browser cannot keep.
        */}
        {platform.capabilities.supportsAlwaysOnTop ? (
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
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  !preferences.confirmBeforeClearing ||
                  window.confirm('Remove every task from the queue?')
                ) {
                  clearTasks();
                }
              }}
            >
              Clear task queue
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  !preferences.confirmBeforeClearing ||
                  window.confirm('Remove the session history? This cannot be undone.')
                ) {
                  clearHistory();
                }
              }}
            >
              Clear history
            </Button>

            <AboutDialog label="About" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
