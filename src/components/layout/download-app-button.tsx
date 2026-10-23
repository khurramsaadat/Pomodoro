import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_RELEASES_URL } from '@/domain/app-info';

export interface DownloadAppButtonProps {
  /** Additional classes for the trigger. */
  readonly className?: string;
}

/**
 * The header's download: the desktop installer, on the releases page.
 *
 * This is the one affordance the *website* has that the desktop app does
 * not, so the caller renders it only when the platform says it is not on
 * the native tier. A desktop app offering to download itself would be an
 * advertisement for something the user already has; a website offering it
 * is answering the question a visitor arrives with.
 *
 * The link leaves the page in a new tab rather than navigating: the visitor
 * may have a timer running in this one, and the browser's own download tray
 * is where the installer belongs.
 */
export function DownloadAppButton({ className }: DownloadAppButtonProps) {
  return (
    <Button variant="ghost" size="icon" asChild className={className}>
      <a
        href={APP_RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download the desktop app"
        title="Download the desktop app"
      >
        <Download className="size-4" />
      </a>
    </Button>
  );
}
