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
 * The keyboard shortcuts, shown in a dialog.
 *
 * A shortcut the user cannot discover is a shortcut they will never use, so
 * the list has to be reachable without reading the source. The dialog is
 * the natural home for it: it is a reference, not a control.
 */
export function ShortcutsDialog() {
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
          {SHORTCUTS.map((shortcut, index) => (
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
