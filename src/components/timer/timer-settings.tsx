import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { configFromPreset, TIMER_PRESETS } from '@/domain/presets';
import { minutesToMs } from '@/lib/time';
import { useTimerStore } from '@/store/timer-store';

/**
 * Session length and auto-start settings.
 *
 * Durations are edited in minutes; the engine works in milliseconds.
 */
export function TimerSettings() {
  const config = useTimerStore((store) => store.config);
  const setConfig = useTimerStore((store) => store.setConfig);
  const id = useId();

  const workMinutes = Math.round(config.workMs / 60_000);
  const shortBreakMinutes = Math.round(config.shortBreakMs / 60_000);
  const longBreakMinutes = Math.round(config.longBreakMs / 60_000);

  const update = (patch: Partial<typeof config>): void => {
    setConfig({ ...config, ...patch });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session settings</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          {TIMER_PRESETS.map((preset) => {
            const isActive =
              preset.workMinutes === workMinutes &&
              preset.shortBreakMinutes === shortBreakMinutes &&
              preset.longBreakMinutes === longBreakMinutes;

            return (
              <Button
                key={preset.id}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConfig(configFromPreset(preset, {
                  longBreakInterval: config.longBreakInterval,
                  autoStartBreaks: config.autoStartBreaks,
                  autoStartWork: config.autoStartWork,
                }))}
                className="h-auto flex-col gap-0.5 py-2.5"
              >
                <span className="text-xs font-medium">{preset.label}</span>
                <span className="text-[10px] font-normal opacity-80">{preset.summary}</span>
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-work`}>Focus (min)</Label>
            <input
              id={`${id}-work`}
              type="number"
              min={1}
              max={120}
              value={workMinutes}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) {
                  update({ workMs: minutesToMs(value) });
                }
              }}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-short`}>Short break (min)</Label>
            <input
              id={`${id}-short`}
              type="number"
              min={1}
              max={60}
              value={shortBreakMinutes}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) {
                  update({ shortBreakMs: minutesToMs(value) });
                }
              }}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-long`}>Long break (min)</Label>
            <input
              id={`${id}-long`}
              type="number"
              min={1}
              max={90}
              value={longBreakMinutes}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) {
                  update({ longBreakMs: minutesToMs(value) });
                }
              }}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-auto-breaks`} className="font-normal">
              Auto-start breaks
            </Label>
            <Switch
              id={`${id}-auto-breaks`}
              checked={config.autoStartBreaks}
              onCheckedChange={(checked) => update({ autoStartBreaks: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-auto-work`} className="font-normal">
              Auto-start focus sessions
            </Label>
            <Switch
              id={`${id}-auto-work`}
              checked={config.autoStartWork}
              onCheckedChange={(checked) => update({ autoStartWork: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
