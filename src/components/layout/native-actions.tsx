import { MonitorDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { platform } from '@/platform';
import { cn } from '@/lib/utils';

/**
 * The header button that hides the window to the system tray.
 *
 * The button only exists in the native tier. A browser tab cannot be hidden
 * to a notification area, so drawing the button there would be a lie — the
 * web tier simply does not have this affordance.
 */
export function NativeActions() {
  if (!platform.capabilities.supportsTray) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Hide to the system tray"
      title="Hide to the system tray"
      className={cn('hidden', '[@media(hover:hover)]:inline-flex')}
      onClick={() => {
        // The backend owns the window, so the hide is a command rather than
        // a DOM operation. A failure here is not worth reporting: the
        // window stays where it is, which is a harmless outcome.
        void platform.hideWindow();
      }}
    >
      <MonitorDown className="size-4" />
    </Button>
  );
}
