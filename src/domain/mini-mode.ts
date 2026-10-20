/**
 * The mini timer: a small, floating view of the countdown that sits in a
 * corner of the screen.
 *
 * The position is stored as a *corner* plus an offset rather than as raw
 * pixels, so the widget stays anchored to the same corner when the window is
 * resized or the screen is a different size. The offset is what lets the
 * user nudge the widget away from the corner without losing the anchoring.
 *
 * Everything here is pure: the corner arithmetic is the fiddly part of the
 * feature, and keeping it out of the component makes it testable.
 */

/** The corner of the viewport the mini timer is anchored to. */
export type MiniCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** Where the mini timer sits, as a corner plus an offset from it. */
export interface MiniPosition {
  readonly corner: MiniCorner;
  /** Horizontal offset from the corner's anchor, in pixels. */
  readonly offsetX: number;
  /** Vertical offset from the corner's anchor, in pixels. */
  readonly offsetY: number;
}

/** The gap kept between the widget and the edge of the viewport. */
export const MINI_MARGIN = 16;

/** The nominal width of the widget, used before it has been measured. */
export const MINI_WIDTH = 240;

/** The nominal height of the widget, used before it has been measured. */
export const MINI_HEIGHT = 150;

/**
 * The size the dashboard window is restored to when mini mode ends.
 *
 * These are logical pixels, and they are the same numbers the window
 * configuration uses, so the dashboard comes back exactly as it was.
 */
export const DASHBOARD_WIDTH = 1180;

/** The height the dashboard window is restored to when mini mode ends. */
export const DASHBOARD_HEIGHT = 820;

/** Every corner the widget can be anchored to. */
export const MINI_CORNERS: readonly MiniCorner[] = [
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
];

/** Where the widget starts out: the bottom right, out of the way. */
export const DEFAULT_MINI_POSITION: MiniPosition = {
  corner: 'bottomRight',
  offsetX: 0,
  offsetY: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Whether a value names one of the four corners. */
export function isMiniCorner(value: unknown): value is MiniCorner {
  return typeof value === 'string' && (MINI_CORNERS as readonly string[]).includes(value);
}

/**
 * Repairs an arbitrary value into a usable position.
 *
 * A corrupt corner falls back to the default and a corrupt offset falls back
 * to zero, so a bad payload can never leave the widget off screen.
 */
export function normalizeMiniPosition(value: unknown): MiniPosition {
  if (!isRecord(value)) {
    return DEFAULT_MINI_POSITION;
  }

  const offset = (raw: unknown): number =>
    typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0;

  return {
    corner: isMiniCorner(value.corner) ? value.corner : DEFAULT_MINI_POSITION.corner,
    offsetX: offset(value.offsetX),
    offsetY: offset(value.offsetY),
  };
}

/** A point in the viewport, in pixels from the top-left. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The top-left corner of the widget when it is anchored to `corner`.
 *
 * The right and bottom corners are measured from the far edge of the
 * viewport, so the widget keeps its margin from that edge when the window
 * is resized.
 */
export function cornerAnchor(
  corner: MiniCorner,
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
): Point {
  const isRight = corner === 'topRight' || corner === 'bottomRight';
  const isBottom = corner === 'bottomLeft' || corner === 'bottomRight';

  return {
    x: isRight ? viewportWidth - width - MINI_MARGIN : MINI_MARGIN,
    y: isBottom ? viewportHeight - height - MINI_MARGIN : MINI_MARGIN,
  };
}

/**
 * Keeps a position fully on screen.
 *
 * The widget is never allowed to be dragged out of reach, which matters
 * because there is no window chrome to drag it back with.
 */
export function clampToViewport(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
): Point {
  const maxLeft = Math.max(0, viewportWidth - width);
  const maxTop = Math.max(0, viewportHeight - height);

  return {
    x: Math.min(maxLeft, Math.max(0, left)),
    y: Math.min(maxTop, Math.max(0, top)),
  };
}

/**
 * The corner a given position is closest to.
 *
 * The widget's *centre* decides the corner rather than its top-left, so a
 * widget that straddles the middle of the screen still snaps to the side
 * the user was aiming at.
 */
export function nearestCorner(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
): MiniCorner {
  const centreX = left + width / 2;
  const centreY = top + height / 2;
  const isRight = centreX >= viewportWidth / 2;
  const isBottom = centreY >= viewportHeight / 2;

  if (isBottom) {
    return isRight ? 'bottomRight' : 'bottomLeft';
  }
  return isRight ? 'topRight' : 'topLeft';
}

/**
 * Converts a dragged position into a corner and an offset.
 *
 * This is what turns a free-floating drag into the persisted representation:
 * the corner is the one the widget was dropped nearest to, and the offset is
 * how far from that corner's anchor it was dropped.
 */
export function positionToMiniPosition(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
): MiniPosition {
  const corner = nearestCorner(left, top, viewportWidth, viewportHeight, width, height);
  const anchor = cornerAnchor(corner, viewportWidth, viewportHeight, width, height);

  return {
    corner,
    offsetX: Math.round(left - anchor.x),
    offsetY: Math.round(top - anchor.y),
  };
}

/**
 * The position of a widget the *host* has placed.
 *
 * The native tier gets this from the operating system, which knows where
 * the user has actually dragged the window. The web tier gets it from the
 * widget's own drag handling. Both are expressed relative to the top left
 * of the work area, so the corner can be worked out the same way in both.
 */
export interface ReportedMiniPosition {
  /** The left edge of the window. */
  readonly x: number;
  /** The top edge of the window. */
  readonly y: number;
  /** The width of the work area the window sits in. */
  readonly areaWidth: number;
  /** The height of the work area the window sits in. */
  readonly areaHeight: number;
  /** The width of the window itself. */
  readonly width: number;
  /** The height of the window itself. */
  readonly height: number;
}

/**
 * Converts a reported window position into the stored representation.
 *
 * The corner is worked out from where the window *is*, not from where it
 * was dropped, so the widget comes back in the same place next time. A
 * report that carries no usable area is ignored, because a position
 * relative to an unknown screen is not a position at all.
 */
export function reportedPositionToMiniPosition(
  reported: ReportedMiniPosition,
): MiniPosition | null {
  if (reported.areaWidth <= 0 || reported.areaHeight <= 0) {
    return null;
  }

  const width = reported.width > 0 ? reported.width : MINI_WIDTH;
  const height = reported.height > 0 ? reported.height : MINI_HEIGHT;

  return positionToMiniPosition(
    reported.x,
    reported.y,
    reported.areaWidth,
    reported.areaHeight,
    width,
    height,
  );
}
