import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripVertical, Pause, Play, X } from 'lucide-react';

import { useRemaining, useTimerEngine } from '@/components/timer/timer-engine';
import { Button } from '@/components/ui/button';
import { PhaseIcon } from '@/components/timer/phase-icon';
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
import { cn } from '@/lib/utils';
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

/**
 * How the mini timer is presented.
 *
 *  - `floating` draws the widget inside the page, in a corner of the
 *    viewport. This is the web tier's only option, because a browser tab
 *    has no window of its own to shrink.
 *  - `filling` draws the widget edge to edge. The native tier's window
 *    *is* the widget, so the page has nothing else to draw and the widget
 *    must not be floating inside a window that is already the right size.
 */
export type MiniTimerVariant = 'floating' | 'filling';

export interface MiniTimerProps {
  /** How the widget is presented. */
  readonly variant?: MiniTimerVariant;
}

export function MiniTimer({ variant = 'floating' }: MiniTimerProps = {}) {
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

  // The filling variant is not dragged by the page: the operating system
  // moves the window, so the page has no drag to handle.
  const floating = variant === 'floating';

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
  // widget stays inside the viewport. The filling variant has no resting
  // position: it fills the window it is in.
  const [resting, setResting] = useState<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!floating) {
      return;
    }

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
  }, [position, size, floating]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!floating || event.button !== 0) {
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
    },
    [floating],
  );

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
      className={cn(
        'bg-card text-card-foreground z-50 flex flex-col overflow-hidden border shadow-lg',
        floating
          ? 'fixed rounded-xl'
          : 'h-dvh w-full rounded-none border-0 shadow-none',
      )}
      style={
        floating
          ? {
              left: `${left}px`,
              top: `${top}px`,
              width: `${size.width}px`,
            }
          : undefined
      }
      data-testid="mini-timer"
      role="region"
      aria-label="Mini timer"
    >
      {/*
        The bar is the widget's handle, and on the native tier it is what
        the operating system drags.

        `deep` is the important part. Tauri's drag script walks the click's
        composed path and stops at the first *clickable* element that does
        not carry the attribute — and every button in this bar is
        clickable. A bare attribute only ever matches a click on the bar
        itself, so the empty space between the buttons would drag the
        window and the buttons would not. `deep` makes the whole subtree
        draggable, and the buttons opt back out below.
      */}
      <div
        className="bg-muted/40 flex items-center gap-1 border-b px-1.5 py-1"
        data-tauri-drag-region="deep"
      >
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // The handle is itself a drag region: it carries the attribute
          // explicitly, so it is allowed to drag even though it is a
          // button. It is `deep` rather than bare, because the grip is an
          // SVG icon — and a click on the icon is not a click on the
          // button, so a bare attribute would never match it.
          data-tauri-drag-region="deep"
          className="text-muted-foreground hover:text-foreground flex cursor-grab touch-none items-center gap-1 px-1 py-0.5 text-[11px] font-medium active:cursor-grabbing"
          aria-label="Drag the mini timer"
          title="Drag to move"
        >
          <GripVertical className="size-3.5" />
          {/*
            The widget wears the phase's glyph as well as its word: at this
            size the cup or the chair is read before the label is.
          */}
          <PhaseIcon phase={state.phase} className="size-3" />
          {phaseLabel(state.phase)}
        </button>

        <span className="text-muted-foreground ml-1 text-[11px] tabular-nums">
          {cycle.completed}/{cycle.total}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={isRunning ? 'Pause the mini timer' : 'Start the mini timer'}
            title={isRunning ? 'Pause' : 'Start'}
            className="size-6"
            // The controls are *not* handles: a click on them must run
            // the control, not move the window.
            data-tauri-drag-region="false"
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
            data-tauri-drag-region="false"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/*
        The countdown sits *inside* the ring rather than beneath it. The
        window is a fixed 240 by 150, and the ring plus a line of text
        beside it does not fit: the number was being cut off at the bottom.
        Inside the ring, the whole widget is legible in the space there is.
      */}
      <div className="relative flex flex-1 items-center justify-center p-2">
        <div
          className="relative flex size-[88px] shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${progress * 360}deg, var(--color-border) 0deg)`,
          }}
          aria-hidden="true"
        >
          <div className="bg-card absolute inset-[4px] rounded-full" />
        </div>

        <span
          className="tabular-nums absolute text-2xl leading-none font-semibold"
          data-testid="mini-countdown"
        >
          {formatDuration(remaining)}
        </span>
      </div>
    </div>
  );
}
