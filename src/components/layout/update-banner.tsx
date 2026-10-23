import { Download, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/domain/app-info';
import type { AvailableUpdate } from '@/domain/updates';
import { cn } from '@/lib/utils';

export interface UpdateBannerProps {
  /** The release to announce. */
  readonly update: AvailableUpdate;
  /** Hides the notice, and remembers that it was hidden for this version. */
  readonly onDismiss: () => void;
  /** Additional classes for the strip. */
  readonly className?: string;
}

/**
 * The strip that says a newer version is ready.
 *
 * It is a strip rather than a toast. A toast disappears on its own after a
 * few seconds, which is right for a fact about a phase that just ended and
 * wrong for the one piece of information a user may need to act on later:
 * a release announcement that vanishes while they are mid-session is an
 * announcement they will never see. The strip stays until it is dismissed,
 * and it sits above the workspace on every tab so it is where the eye
 * already is.
 *
 * The download opens in a new tab, on purpose: the timer keeps counting,
 * and the browser's own download tray is where the installer lands. The
 * app never asks the page to navigate away from a running session.
 */
export function UpdateBanner({ update, onDismiss, className }: UpdateBannerProps) {
  return (
    <div
      role="status"
      data-testid="update-banner"
      className={cn(
        'border-primary/30 bg-primary/5 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5',
        className,
      )}
    >
      <Download className="text-primary size-4 shrink-0" aria-hidden="true" />

      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Version {update.version} is available.</span>{' '}
        <span className="text-muted-foreground">You are running {APP_VERSION}.</span>
      </p>

      <Button size="sm" asChild>
        <a href={update.url} target="_blank" rel="noopener noreferrer">
          <Download className="size-3.5" />
          Download
        </a>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label="Dismiss the update notice"
        title="Dismiss"
        className="size-8 shrink-0"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
