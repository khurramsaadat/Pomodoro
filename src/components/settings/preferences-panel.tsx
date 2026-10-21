import { useId } from 'react';
import { Settings2 } from 'lucide-react';

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
          <Settings2 className="size-4" />
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

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Backup</h3>
            <span className="text-muted-foreground text-xs">
              Save everything to a file, or restore it from one.
            </span>
          </div>

          <BackupControls />
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">Data</h3>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
