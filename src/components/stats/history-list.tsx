import { useState } from 'react';
import { History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type SessionEntry } from '@/domain/history';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

export interface HistoryListProps {
  /** The recorded sessions, most recent first. */
  readonly entries: readonly SessionEntry[];
  /** Additional classes for the container. */
  readonly className?: string;
}

/** How many sessions the list shows before it is expanded. */
const COLLAPSED_COUNT = 8;

/**
 * The session log.
 *
 * The history is the app's only durable record, and every statistic is
 * derived from it — but the log itself was invisible, so there was no way
 * to ask "what did I do last Tuesday?" beyond the seven-day chart.
 *
 * An abandoned session is shown too, marked as such. It is the interruption
 * the method is supposed to surface, so hiding it would defeat the point.
 */
export function HistoryList({ entries, className }: HistoryListProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <Card className={cn('py-6', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Recent sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
            No sessions yet — the log fills up as you work.
          </p>
        </CardContent>
      </Card>
    );
  }

  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);
  const hidden = entries.length - visible.length;

  return (
    <Card className={cn('py-6', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          Recent sessions
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col divide-y">
          {visible.map((entry) => {
            const isFocus = entry.phase === 'work' && !entry.voided;

            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
                data-testid="history-entry"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate">
                    {entry.taskTitle ?? 'No task'}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(entry.endedAt).toLocaleString()}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {entry.voided ? (
                    <Badge variant="secondary" className="text-[10px]">
                      abandoned
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {isFocus ? formatDuration(entry.durationMs) : 'break'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {hidden > 0 || expanded ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            className="text-muted-foreground h-7 self-start text-xs"
          >
            {expanded ? 'Show less' : `Show ${hidden} more`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
