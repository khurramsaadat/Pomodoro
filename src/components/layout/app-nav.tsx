import { BarChart3, ListTodo, Settings } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/task-store';

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
  // How many tasks are still open. It is a primitive, so the bar re-renders
  // when the number changes rather than on every store write.
  const openTasks = useTaskStore((store) => store.tasks.filter((task) => !task.done).length);

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
        <span className="relative">
          <ListTodo />

          {/*
            The count is a corner badge on the icon. It is hidden from
            assistive technology, because the tab's name is the destination
            and not "Tasks 4" — the queue itself is one tap away and says
            what the number means.
          */}
          {openTasks > 0 ? (
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground absolute -top-1.5 -right-2 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums"
            >
              {openTasks > 9 ? '9+' : openTasks}
            </span>
          ) : null}
        </span>
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
