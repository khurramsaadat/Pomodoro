import { BarChart3, ListTodo, Settings } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The navigation bar: the three workspaces, pinned to the bottom of the
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
 * meaning, because a phone-width bar has room for three icons and not for
 * three words. The accessible name is still there either way — the label is
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
      {/*
        The queue comes first. It is the question the user asks most often
        — *what am I working on?* — and the answer it gives decides what the
        session is for, so it is the first thing the bar offers.
      */}
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
        <Settings />
        <span className="hidden sm:inline">Settings</span>
        <span className="sr-only sm:hidden">Settings</span>
      </TabsTrigger>
    </TabsList>
  );
}
