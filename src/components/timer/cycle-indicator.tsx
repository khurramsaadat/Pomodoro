import { cn } from '@/lib/utils';

export interface CycleIndicatorProps {
  /** How many focus sessions make up a full set. */
  readonly total: number;
  /** How many focus sessions in the current set have been completed. */
  readonly completed: number;
  /** The colour of the completed markers. */
  readonly color?: string;
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * Shows progress towards the next long break.
 *
 * Each dot is one focus session. Completed sessions are filled with the
 * phase colour; the current session is outlined so the user can see what is
 * in progress at a glance.
 */
export function CycleIndicator({
  total,
  completed,
  color = 'var(--color-phase-work)',
  className,
}: CycleIndicatorProps) {
  const markers = Array.from({ length: total }, (_, index) => index);

  return (
    <div
      className={cn('flex items-center justify-center gap-2', className)}
      role="group"
      aria-label={`${completed} of ${total} focus sessions completed`}
    >
      {markers.map((index) => {
        const isDone = index < completed;
        const isCurrent = index === completed;

        return (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              'size-2.5 rounded-full border transition-colors',
              isDone && 'border-transparent',
              !isDone && 'border-border',
            )}
            style={isDone ? { backgroundColor: color } : undefined}
            data-state={isCurrent ? 'current' : isDone ? 'done' : 'upcoming'}
          />
        );
      })}
    </div>
  );
}
