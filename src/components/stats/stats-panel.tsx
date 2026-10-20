import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Flame, Target, TrendingUp } from 'lucide-react';

import { FocusChart } from '@/components/stats/focus-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  breakdownByTask,
  currentStreak,
  dailyProgress,
  focusMsByDay,
  interruptionCount,
  totalFocusMs,
} from '@/domain/history';
import { formatDuration } from '@/lib/time';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';

export interface StatsPanelProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/** The number of days shown in the focus chart. */
const CHART_DAYS = 7;

/** How often the panel re-reads the clock, in milliseconds. */
const CLOCK_INTERVAL_MS = 60_000;

/**
 * The statistics panel.
 *
 * The numbers here are the ones that actually predict whether the method is
 * working: focus time, how consistently it happens, and how often a session
 * was interrupted.
 */
export function StatsPanel({ className }: StatsPanelProps) {
  const entries = useHistoryStore((store) => store.entries);
  const dailyGoal = usePreferencesStore((store) => store.preferences.dailyGoal);

  // The clock lives in state rather than being read during render, so the
  // panel stays a pure function of its props. It ticks once a minute, which
  // is enough to notice the day rolling over without re-rendering constantly.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const progress = useMemo(
    () => dailyProgress(entries, dailyGoal, now),
    [entries, dailyGoal, now],
  );
  const chartData = useMemo(() => focusMsByDay(entries, CHART_DAYS, now), [entries, now]);
  const breakdown = useMemo(() => breakdownByTask(entries), [entries]);
  const streak = useMemo(() => currentStreak(entries, now), [entries, now]);

  const totalFocus = totalFocusMs(entries);
  const interruptions = interruptionCount(entries);

  const stats = [
    {
      id: 'today',
      label: 'Today',
      value: `${progress.sessions}`,
      suffix: `/ ${progress.goal}`,
      icon: Target,
    },
    {
      id: 'total',
      label: 'Total focus',
      value: formatDuration(totalFocus),
      suffix: '',
      icon: Flame,
    },
    {
      id: 'streak',
      label: 'Day streak',
      value: `${streak}`,
      suffix: streak === 1 ? ' day' : ' days',
      icon: TrendingUp,
    },
    {
      id: 'interruptions',
      label: 'Interruptions',
      value: `${interruptions}`,
      suffix: '',
      icon: BarChart3,
    },
  ] as const;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" />
          Statistics
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center"
              >
                <Icon className="text-muted-foreground size-4" aria-hidden="true" />
                <span className="tabular-nums text-lg leading-none font-semibold">
                  {stat.value}
                  {stat.suffix ? (
                    <span className="text-muted-foreground text-xs font-normal">
                      {stat.suffix}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-[11px] leading-tight">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Last {CHART_DAYS} days</h3>
            {progress.met ? (
              <Badge variant="secondary" className="text-[10px]">
                Goal reached
              </Badge>
            ) : null}
          </div>
          <FocusChart data={chartData} />
        </div>

        {breakdown.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">By task</h3>
            <ul className="flex flex-col gap-1.5">
              {breakdown.slice(0, 5).map((entry) => (
                <li
                  key={entry.taskId ?? 'unassigned'}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{entry.taskTitle}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {entry.sessions} session{entry.sessions === 1 ? '' : 's'} ·{' '}
                    {formatDuration(entry.focusMs)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
