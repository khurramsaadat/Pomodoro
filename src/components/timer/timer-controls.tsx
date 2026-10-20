import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface TimerControlsProps {
  /** The timer's current status. */
  readonly status: 'idle' | 'running' | 'paused';
  /** Starts or pauses the timer. */
  readonly onToggle: () => void;
  /** Resets the current phase. */
  readonly onReset: () => void;
  /** Skips to the next phase. */
  readonly onSkip: () => void;
  /** The colour of the primary action button. */
  readonly accentColor?: string;
}

/**
 * The primary timer controls.
 *
 * Start and pause share one button because they are mutually exclusive
 * actions on the same state; reset and skip sit beside it as secondary
 * actions so the primary action stays unambiguous.
 */
export function TimerControls({
  status,
  onToggle,
  onReset,
  onSkip,
  accentColor,
}: TimerControlsProps) {
  const isRunning = status === 'running';

  return (
    <div className="flex items-center justify-center gap-2.5">
      <Button
        variant="outline"
        size="icon-lg"
        onClick={onReset}
        aria-label="Reset current phase"
        title="Reset current phase"
      >
        <RotateCcw />
      </Button>

      <Button
        size="icon-lg"
        onClick={onToggle}
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        title={isRunning ? 'Pause timer' : 'Start timer'}
        className="size-16 rounded-full shadow-lg"
        style={
          accentColor
            ? { backgroundColor: accentColor, color: 'var(--color-background)' }
            : undefined
        }
      >
        {isRunning ? <Pause className="size-6" /> : <Play className="size-6" />}
      </Button>

      <Button
        variant="outline"
        size="icon-lg"
        onClick={onSkip}
        aria-label="Skip to next phase"
        title="Skip to next phase"
      >
        <SkipForward />
      </Button>
    </div>
  );
}
