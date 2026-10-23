import { useId } from 'react';
import { AudioLines, CloudRain, Flame, Trees, Volume2, Waves, Wind } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AMBIENCE_OPTIONS, type AmbienceId } from '@/domain/ambience';
import { usePreferencesStore } from '@/store/preferences-store';
import { cn } from '@/lib/utils';

export interface AmbiencePickerProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/** The icon that stands for an ambience. */
function ambienceIcon(id: AmbienceId): typeof Wind {
  switch (id) {
    case 'brown':
      return AudioLines;
    case 'white':
      return Wind;
    case 'rain':
      return CloudRain;
    case 'waves':
      return Waves;
    case 'fire':
      return Flame;
    case 'forest':
      return Trees;
    case 'none':
      return Volume2;
  }
}

/**
 * The hue each ambience's icon is drawn in, idle and selected.
 *
 * The row is read by shape and colour before it is read by label: rain is
 * blue, fire is orange, a wood is green. "None" is the exception, because
 * silence has no colour of its own and should not pretend to.
 *
 * The selected chip is a solid primary blue, so its tone has to be the
 * lighter one: the hue is the point of the icon, and a hue that disappears
 * into the chip it sits on is not a hue. Each class is written out in full
 * so the scanner can see it.
 */
const AMBIENCE_ICON_COLOR: Record<AmbienceId, { idle: string; selected: string }> = {
  none: { idle: 'text-muted-foreground', selected: 'text-primary-foreground' },
  brown: { idle: 'text-amber-700 dark:text-amber-500', selected: 'text-amber-300' },
  white: { idle: 'text-slate-600 dark:text-slate-300', selected: 'text-slate-200' },
  rain: { idle: 'text-sky-600 dark:text-sky-400', selected: 'text-sky-300' },
  waves: { idle: 'text-blue-600 dark:text-blue-400', selected: 'text-blue-300' },
  fire: { idle: 'text-orange-600 dark:text-orange-400', selected: 'text-orange-300' },
  forest: { idle: 'text-emerald-700 dark:text-emerald-500', selected: 'text-emerald-300' },
};

/**
 * The background ambience picker.
 *
 * The ambience is a *background* sound: it plays while a session runs, and
 * it stops the moment the session stops. It is chosen here and it is
 * followed by the timer, so the choice is a preference rather than a
 * control of the sound engine.
 *
 * The volume is a separate control because the two decisions are separate:
 * *which* sound, and *how loud*. A single slider cannot answer both, and a
 * list of loudness levels cannot either.
 */
export function AmbiencePicker({ className }: AmbiencePickerProps) {
  const backgroundSound = usePreferencesStore((store) => store.preferences.backgroundSound);
  const backgroundVolume = usePreferencesStore((store) => store.preferences.backgroundVolume);
  const updatePreference = usePreferencesStore((store) => store.updatePreference);

  const id = useId();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={`${id}-ambience-label`} className="text-sm font-medium">
        Background ambience
      </span>

      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby={`${id}-ambience-label`}
      >
        {AMBIENCE_OPTIONS.map((option) => {
          const selected = option.id === backgroundSound;
          const Icon = ambienceIcon(option.id);
          const color = AMBIENCE_ICON_COLOR[option.id];

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.description}
              onClick={() => updatePreference('backgroundSound', option.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors motion-safe:active:scale-[0.97]',
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent',
              )}
            >
              <Icon
                className={cn('size-3.5', selected ? color.selected : color.idle)}
                aria-hidden="true"
              />
              {option.label}
            </button>
          );
        })}
      </div>

      <span className="text-muted-foreground text-xs">
        {AMBIENCE_OPTIONS.find((option) => option.id === backgroundSound)?.description ??
          'No background sound.'}
      </span>

      {/*
        The volume only means anything once a sound has been chosen, so it
        is hidden otherwise. A control that cannot do anything is a
        control that confuses.
      */}
      {backgroundSound === 'none' ? null : (
        <div className="mt-1 flex items-center gap-3">
          <Label htmlFor={`${id}-ambience-volume`} className="font-normal">
            Ambience volume
          </Label>
          <Input
            id={`${id}-ambience-volume`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(backgroundVolume * 100)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                updatePreference('backgroundVolume', value / 100);
              }
            }}
            className="w-32"
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round(backgroundVolume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
