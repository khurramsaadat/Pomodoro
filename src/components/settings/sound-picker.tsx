import { useId } from 'react';
import { Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SOUND_OPTIONS, type SoundId } from '@/domain/sounds';
import { playChime } from '@/lib/audio';
import { usePreferencesStore } from '@/store/preferences-store';
import { cn } from '@/lib/utils';

export interface SoundPickerProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/** The volume the preview is played at. */
const PREVIEW_VOLUME = 0.6;

/**
 * The sound picker.
 *
 * A sound the user has never heard is a sound they cannot choose between,
 * so every option can be *played* rather than merely read. The preview is
 * what turns a list of names into a decision.
 *
 * The sound is a preference rather than a fact about the timer, so it lives
 * with the other preferences and is persisted with them.
 */
export function SoundPicker({ className }: SoundPickerProps) {
  const completionSound = usePreferencesStore((store) => store.preferences.completionSound);
  const updatePreference = usePreferencesStore((store) => store.updatePreference);

  const id = useId();

  const choose = (sound: SoundId): void => {
    updatePreference('completionSound', sound);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={`${id}-sound`} className="font-normal">
        Completion sound
      </Label>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Completion sound">
        {SOUND_OPTIONS.map((option) => {
          const selected = option.id === completionSound;

          return (
            <Button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              variant={selected ? 'default' : 'outline'}
              size="sm"
              title={option.description}
              onClick={() => choose(option.id)}
              className="gap-1.5"
            >
              <Volume2 className="size-3.5" />
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">
          {SOUND_OPTIONS.find((option) => option.id === completionSound)?.description ??
            'A soft two-note chime.'}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            playChime({ volume: PREVIEW_VOLUME, sound: completionSound });
          }}
          className="h-7 shrink-0 text-xs"
        >
          Preview
        </Button>
      </div>
    </div>
  );
}
