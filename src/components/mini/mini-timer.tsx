import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripVertical, Pause, Play, X } from 'lucide-react';

import { useRemaining, useTimerEngine } from '@/components/timer/timer-engine';
import { Button } from '@/components/ui/button';
import { cycleProgress, durationForPhase, phaseLabel } from '@/domain/timer';
import {
  clampToViewport,
  cornerAnchor,
  MINI_HEIGHT,
  MINI_WIDTH,
  positionToMiniPosition,
  type Point,
} from '@/domain/mini-mode';
import { phaseColor } from '@/lib/phase';
import { formatDuration } from '@/lib/time';
import { useMiniModeStore } from '@/store/mini-mode-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * The mini timer: a small, floating countdown that sits in a corner of the
 * window.
 *
 * It is a *view* of the same timer as the main panel — there is one timer,
 * and this reads the shared engine rather than keeping a second copy of the
 * state.
 *
 * The widget is draggable and snaps to whichever corner it is dropped
 * nearest to. The position is persisted as a corner plus an offset, so it
 * stays anchored to that corner when the window is resized.
 */

interface DragState {
  /** Where the pointer went down, in client coordinates. */
  readonly originX: number;
  readonly originY: number;
  /** The widget's position when the drag started. */
  readonly startLeft: number;
  readonly startTop: number;
}

export function MiniTimer() {
  const state = useTimerStore((store) => store.state);
  const config = useTimerStore((store) => store.config);

  const remaining = useRemaining();
  const { toggle } = useTimerEngine();

  const position = useMiniModeStore((store) => store.position);
  const setPosition = useMiniModeStore((store) => store.setPosition);
  const setEnabled = useMiniModeStore((store) => store.setEnabled);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [size, setSize] = useState({ width: MINI_WIDTH, height: MINI_HEIGHT });
  const [drag, setDrag] = useState<Point | null>(null);

  const duration = durationForPhase(state.phase, config);
  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const color = phaseColor(state.phase);
  const cycle = cycleProgress(state, config);
  const isRunning = state.status === 'running';

  // Measure the widget so the drag maths and the clamping use its real
  // size rather than a guess.
  useLayoutEffect(() => {
    const element = widgetRef.current;
    if (!element) {
      return;
    }

    const measure = (): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    measure();

    // Not every environment implements `ResizeObserver` — jsdom does not, and
    // neither does an older browser. The one-off measurement above is enough
    // to place the widget; the observer is only there to keep it accurate
    // when the widget's own content changes its size.
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  // The resting position, recomputed whenever the window is resized so the
  // widget stays inside the viewport.
  const [resting, setResting] = useState<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const update = (): void => {
      const anchor = cornerAnchor(
        position.corner,
        window.innerWidth,
        window.innerHeight,
        size.width,
        size.height,
      );

      setResting(
        clampToViewport(
          anchor.x + position.offsetX,
          anchor.y + position.offsetY,
          window.innerWidth,
          window.innerHeight,
          size.width,
          size.height,
        ),
      );
    };

    update();

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [position, size]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const element = event.currentTarget;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    dragRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };

    // The pointer is captured on the *handle*, not on the widget: capture
    // retargets every subsequent pointer event to the capturing element, so
    // capturing the widget would deliver the moves to the widget and the
    // handle's own handlers would never see them.
    //
    // Capture is best-effort: it is not implemented everywhere, and a failure
    // here must not stop the drag from working.
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Ignore: the drag still works, it just ends when the pointer leaves.
    }

    event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const dragState = dragRef.current;
      if (!dragState) {
        return;
      }

      const next = clampToViewport(
        dragState.startLeft + (event.clientX - dragState.originX),
        dragState.startTop + (event.clientY - dragState.originY),
        window.innerWidth,
        window.innerHeight,
        size.width,
        size.height,
      );

      setDrag(next);
    },
    [size],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const dragState = dragRef.current;
      if (!dragState) {
        return;
      }

      dragRef.current = null;

      const element = event.currentTarget;
      try {
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore: releasing is best-effort.
      }

      const final = clampToViewport(
        dragState.startLeft + (event.clientX - dragState.originX),
        dragState.startTop + (event.clientY - dragState.originY),
        window.innerWidth,
        window.innerHeight,
        size.width,
        size.height,
      );

      setDrag(null);

      // The drop is converted into a corner and an offset, so the widget
      // stays anchored to that corner rather than to a fixed pixel.
      setPosition(
        positionToMiniPosition(
          final.x,
          final.y,
          window.innerWidth,
          window.innerHeight,
          size.width,
          size.height,
        ),
      );
    },
    [setPosition, size],
  );

  // While dragging, suppress the text selection that a long press would
  // otherwise trigger.
  useEffect(() => {
    if (!drag) {
      return;
    }

    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.userSelect = previous;
    };
  }, [drag]);

  const left = drag?.x ?? resting.x;
  const top = drag?.y ?? resting.y;

  return (
    <div
      ref={widgetRef}
      className="bg-card text-card-foreground fixed z-50 flex flex-col overflow-hidden rounded-xl border shadow-lg"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${size.width}px`,
      }}
      data-testid="mini-timer"
      role="region"
      aria-label="Mini timer"
    >
      <div className="bg-muted/40 flex items-center gap-1 border-b px-1.5 py-1">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="text-muted-foreground hover:text-foreground flex cursor-grab touch-none items-center gap-1 px-1 py-0.5 text-[11px] font-medium active:cursor-grabbing"
          aria-label="Drag the mini timer"
          title="Drag to move"
        >
          <GripVertical className="size-3.5" />
          {phaseLabel(state.phase)}
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={isRunning ? 'Pause the mini timer' : 'Start the mini timer'}
            title={isRunning ? 'Pause' : 'Start'}
            className="size-6"
          >
            {isRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEnabled(false)}
            aria-label="Close the mini timer"
            title="Close"
            className="text-muted-foreground size-6"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className="relative flex size-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${progress * 360}deg, var(--color-border) 0deg)`,
          }}
          aria-hidden="true"
        >
          <div className="bg-card absolute inset-[3px] rounded-full" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="tabular-nums text-2xl leading-none font-semibold"
            data-testid="mini-countdown"
          >
            {formatDuration(remaining)}
          </span>
          <span className="text-muted-foreground mt-1 text-[11px]">
            {cycle.completed}/{cycle.total} in this set
          </span>
        </div>
      </div>
    </div>
  );
}
