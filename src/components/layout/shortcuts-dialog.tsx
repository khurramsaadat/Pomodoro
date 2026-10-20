import { Keyboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { platform } from '@/platform';

/** The shortcuts the app understands, in the order they are listed. */
const SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Start or pause the timer' },
  { keys: 'K', action: 'Start or pause the timer' },
  { keys: '→', action: 'Skip to the next phase' },
  { keys: 'J', action: 'Skip to the next phase' },
  { keys: '←', action: 'Reset the current phase' },
  { keys: 'L', action: 'Reset the current phase' },
];

/**
 * The global shortcut, which is only offered in the native tier.
 *
 * It is listed separately because it works from *anywhere* — including from
 * another application — which makes it a different thing from the in-window
 * shortcuts above.
 */
const NATIVE_SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: 'Ctrl + Shift + Space', action: 'Start or pause the timer, from any application' },
];

/**
 * The keyboard shortcuts, shown in a dialog.
 *
 * A shortcut the user cannot discover is a shortcut they will never use, so
 * the list has to be reachable without reading the source. The dialog is
 * the natural home for it: it is a reference, not a control.
 */
export function ShortcutsDialog() {
  // The global shortcut only exists in the native tier, so it is only
  // listed there. Listing it in a browser would promise something the
  // browser cannot deliver.
  const native = platform.capabilities.supportsGlobalShortcut
    ? NATIVE_SHORTCUTS
    : [];

  const all = [...SHORTCUTS, ...native];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">
          <Keyboard className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            The shortcuts are ignored while you are typing in a field.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          {all.map((shortcut, index) => (
            <div key={`${shortcut.keys}-${shortcut.action}`}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-muted-foreground">{shortcut.action}</span>
                <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
                  {shortcut.keys}
                </kbd>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
