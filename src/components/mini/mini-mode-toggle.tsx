import { Maximize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { cn } from '@/lib/utils';

/**
 * The header button that opens and closes the mini timer.
 *
 * The widget is a *view* of the same timer, not a second one, so opening it
 * never starts or stops anything — the button only controls the visibility.
 */
export function MiniModeToggle() {
  const enabled = useMiniModeStore((store) => store.enabled);
  const setEnabled = useMiniModeStore((store) => store.setEnabled);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setEnabled(!enabled)}
      aria-label={enabled ? 'Hide the mini timer' : 'Show the mini timer'}
      aria-pressed={enabled}
      title={enabled ? 'Hide mini timer' : 'Show mini timer'}
      className={cn(enabled && 'text-primary')}
    >
      <Maximize2 className="size-4" />
    </Button>
  );
}
