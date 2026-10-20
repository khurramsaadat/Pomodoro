import { cn } from '@/lib/utils';

export interface FocusChartProps {
  /** The focus time for each day, oldest first. */
  readonly data: readonly { dayKey: string; focusMs: number; sessions: number }[];
  /** The colour of the bars. */
  readonly color?: string;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * A compact bar chart of the focus time per day.
 *
 * The chart is drawn with plain divs rather than an SVG library: it is a
 * handful of bars, and this keeps the bundle free of a charting dependency
 * that would only ever be used here.
 */
export function FocusChart({ data, color = 'var(--color-phase-work)', className }: FocusChartProps) {
  const max = Math.max(1, ...data.map((entry) => entry.focusMs));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className="flex h-28 items-end gap-1.5 border-b border-border/60"
        role="img"
        aria-label={`Focus time for the last ${data.length} days`}
      >
        {data.map((entry) => {
          const height = Math.round((entry.focusMs / max) * 100);
          const isEmpty = entry.focusMs === 0;

          return (
            <div key={entry.dayKey} className="flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-[height]',
                  isEmpty && 'bg-border/50',
                )}
                style={
                  isEmpty
                    ? { height: '2px' }
                    : { height: `${Math.max(6, height)}%`, backgroundColor: color }
                }
                title={`${entry.dayKey}: ${Math.round(entry.focusMs / 60_000)} min`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {data.map((entry) => {
          const isToday = entry === data[data.length - 1];

          return (
            <span
              key={entry.dayKey}
              className={cn(
                'flex-1 text-center text-[10px] leading-none',
                isToday ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {entry.dayKey.slice(8)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
