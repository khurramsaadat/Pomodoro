import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { APP_AUTHOR, APP_COPYRIGHT, APP_NAME, APP_TAGLINE, APP_VERSION } from '@/domain/app-info';
import { platform } from '@/platform';

export interface AboutDialogProps {
  /** Additional classes for the trigger. */
  readonly className?: string;
  /**
   * The label on the trigger.
   *
   * It is absent in the header, where the trigger is an icon, and present
   * in the Manage card, where the trigger is a named row.
   */
  readonly label?: string;
}

/**
 * The About dialog: what this program is, and where it keeps its data.
 *
 * The two questions are the ones a user actually has about an app they did
 * not write. The first is answered by the app's own metadata, and the
 * second by the *host* — the desktop app keeps its data in a folder the
 * operating system names, and the browser keeps it in a place the user can
 * only clear. Asking the platform for that answer is the whole reason the
 * seam has a `storageLocation` method: the app above the seam must not know
 * which of the two it is on.
 */
export function AboutDialog({ className, label }: AboutDialogProps) {
  const [storage, setStorage] = useState<string | null>(null);

  // The location is asked for when the dialog is opened, because the answer
  // is a promise: the desktop tier has to ask the operating system, and
  // asking it on every render would be asking it far too often.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void platform
      .storageLocation()
      .then((location) => {
        if (!cancelled) {
          setStorage(location);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStorage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {label === undefined ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="About Pomodoro"
            title="About Pomodoro"
            className={className}
          >
            <Info className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={className}>
            <Info />
            {label}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{APP_NAME}</DialogTitle>
          <DialogDescription>{APP_TAGLINE}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Version</dt>
          <dd className="tabular-nums">{APP_VERSION}</dd>

          <dt className="text-muted-foreground">By</dt>
          <dd>{APP_AUTHOR}</dd>

          <dt className="text-muted-foreground">Data</dt>
          <dd className="break-all">
            {storage ?? 'Looking…'}
          </dd>
        </dl>

        {/*
          The location is the folder, not the file: the app keeps its
          settings, its queue and its history in one local store, and a
          user who wants to back them up or clear them needs to know which
          folder that store belongs to. The exact file names are the host's
          business rather than a promise the app can keep across versions.
        */}
        <p className="text-muted-foreground text-xs">
          Settings, the task queue and the session history are kept in the app&apos;s own
          storage, in this location.
        </p>

        <p className="text-muted-foreground text-xs">{APP_COPYRIGHT}</p>
      </DialogContent>
    </Dialog>
  );
}
