import { Keyboard } from 'lucide-react';

import { ShortcutList } from '@/components/layout/shortcut-list';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * The keyboard shortcuts, shown in a dialog.
 *
 * A shortcut the user cannot discover is a shortcut they will never use, so
 * the list has to be reachable without reading the source. The dialog is
 * the natural home for it: it is a reference, not a control.
 *
 * The list itself lives in `shortcut-list.tsx`, because the settings panel
 * shows the same reference.
 */
export function ShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">
          <Keyboard className="text-primary size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="text-primary size-[18px] shrink-0" aria-hidden="true" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            The shortcuts are ignored while you are typing in a field.
          </DialogDescription>
        </DialogHeader>

        <ShortcutList />
      </DialogContent>
    </Dialog>
  );
}
