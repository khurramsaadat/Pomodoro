import { BarChart3, ListTodo, Settings2, Timer } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The navigation bar: the four workspaces, pinned to the bottom of the
 * window.
 *
 * **The bar is a tab list, not a set of links.** The workspaces are
 * already a tab boundary, and a second navigation would mean two pieces of
 * state deciding which one is showing. Radix owns the selection, so the
 * bar only draws it.
 *
 * The bar is drawn in the *shell* rather than in the workspace column
 * because that is where the user expects it: the destinations are always
 * in the same place, whatever the content is doing, and the content
 * scrolls under the bar rather than pushing it away.
 *
 * The labels are hidden on a narrow screen and the icons carry the
 * meaning, because a phone-width bar has room for four icons and not for
 * four words. The accessible name is still there either way — the label is
 * in the DOM, not merely painted.
 */
export function AppNav() {
  return (
    <TabsList
      className={cn(
        'mx-auto flex h-16 w-full max-w-7xl items-stretch justify-around gap-1',
        'bg-transparent p-1.5 sm:p-2',
      )}
    >
      <TabsTrigger
        value="session"
        className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-accent flex-col gap-1 rounded-lg px-2 py-1.5 text-xs"
      >
        <Timer />
        <span className="hidden sm:inline">Session</span>
        <span className="sr-only sm:hidden">Session</span>
      </TabsTrigger>

      <TabsTrigger
        value="tasks"
        className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-accent flex-col gap-1 rounded-lg px-2 py-1.5 text-xs"
      >
        <ListTodo />
        <span className="hidden sm:inline">Tasks</span>
        <span className="sr-only sm:hidden">Tasks</span>
      </TabsTrigger>

      <TabsTrigger
        value="stats"
        className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-accent flex-col gap-1 rounded-lg px-2 py-1.5 text-xs"
      >
        <BarChart3 />
        <span className="hidden sm:inline">Stats</span>
        <span className="sr-only sm:hidden">Stats</span>
      </TabsTrigger>

      <TabsTrigger
        value="settings"
        className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-accent flex-col gap-1 rounded-lg px-2 py-1.5 text-xs"
      >
        <Settings2 />
        <span className="hidden sm:inline">Settings</span>
        <span className="sr-only sm:hidden">Settings</span>
      </TabsTrigger>
    </TabsList>
  );
}
