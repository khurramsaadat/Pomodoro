import { Pin, PinOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { platform } from '@/platform';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '@/store/preferences-store';

/**
 * The header button that keeps the window above the others.
 *
 * A timer the user has to go looking for is a timer they will miss, so the
 * window can be pinned over everything else. The button only exists in the
 * native tier: a browser tab has no z-order, so drawing the button there
 * would be a promise the browser cannot keep.
 *
 * The preference is the source of truth, and the host is told about the
 * change by `usePlatform`, which owns the bridge. The button only records
 * the choice — two places writing the host's state would be two places
 * that could disagree about it.
 */
export function AlwaysOnTopToggle() {
  const alwaysOnTop = usePreferencesStore((store) => store.preferences.alwaysOnTop);
  const updatePreference = usePreferencesStore((store) => store.updatePreference);

  if (!platform.capabilities.supportsAlwaysOnTop) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => updatePreference('alwaysOnTop', !alwaysOnTop)}
      aria-label={alwaysOnTop ? 'Stop keeping the window on top' : 'Keep the window on top'}
      aria-pressed={alwaysOnTop}
      title={alwaysOnTop ? 'Stop keeping the window on top' : 'Keep the window on top'}
      className={cn(alwaysOnTop && 'text-primary')}
    >
      {alwaysOnTop ? <Pin className="size-4" /> : <PinOff className="size-4" />}
    </Button>
  );
}
