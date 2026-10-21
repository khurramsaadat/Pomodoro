import { Separator } from '@/components/ui/separator';
import { platform } from '@/platform';

export interface ShortcutListProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/** One keyboard shortcut. */
interface Shortcut {
  /** The keys, as they are pressed. */
  readonly keys: string;
  /** What the shortcut does. */
  readonly action: string;
}

/** The in-window shortcuts, in the order they are listed. */
const SHORTCUTS: readonly Shortcut[] = [
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
const NATIVE_SHORTCUTS: readonly Shortcut[] = [
  { keys: 'Ctrl + Shift + Space', action: 'Start or pause the timer, from any application' },
];

/**
 * The shortcuts the app understands.
 *
 * The list lives here rather than in the dialog, because it is shown in two
 * places: the dialog in the header, and the settings panel. A shortcut the
 * user cannot discover is a shortcut they will never use, and the settings
 * panel is where a user goes looking for what the app can do.
 *
 * The global shortcut is only listed in the native tier, because listing it
 * in a browser would promise something the browser cannot deliver.
 */
function shortcutList(): readonly Shortcut[] {
  const native = platform.capabilities.supportsGlobalShortcut ? NATIVE_SHORTCUTS : [];

  return [...SHORTCUTS, ...native];
}

/**
 * The shortcut list, drawn as a table of actions and keys.
 *
 * It is a plain list rather than a description list because the pairs are
 * a table in everything but name, and a table reads as one.
 */
export function ShortcutList({ className }: ShortcutListProps) {
  const all = shortcutList();

  return (
    <div className={className}>
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
    </div>
  );
}
