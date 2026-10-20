import { describe, expect, it } from 'vitest';

import {
  clampToViewport,
  cornerAnchor,
  DEFAULT_MINI_POSITION,
  isMiniCorner,
  MINI_MARGIN,
  nearestCorner,
  normalizeMiniPosition,
  positionToMiniPosition,
  reportedPositionToMiniPosition,
} from '@/domain/mini-mode';

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 800;
const WIDTH = 240;
const HEIGHT = 150;

describe('mini corner anchors', () => {
  it('anchors to the top left with the margin', () => {
    expect(cornerAnchor('topLeft', VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT)).toEqual({
      x: MINI_MARGIN,
      y: MINI_MARGIN,
    });
  });

  it('anchors to the bottom right, measured from the far edge', () => {
    expect(cornerAnchor('bottomRight', VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT)).toEqual({
      x: VIEWPORT_WIDTH - WIDTH - MINI_MARGIN,
      y: VIEWPORT_HEIGHT - HEIGHT - MINI_MARGIN,
    });
  });

  it('keeps the margin when the viewport shrinks', () => {
    const anchor = cornerAnchor('bottomRight', 400, 300, WIDTH, HEIGHT);

    expect(anchor.x).toBe(400 - WIDTH - MINI_MARGIN);
    expect(anchor.y).toBe(300 - HEIGHT - MINI_MARGIN);
  });
});

describe('clampToViewport', () => {
  it('keeps a position that is already inside the viewport', () => {
    expect(clampToViewport(100, 200, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT)).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('pulls a position back from beyond the right edge', () => {
    const result = clampToViewport(5000, 200, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT);

    expect(result.x).toBe(VIEWPORT_WIDTH - WIDTH);
    expect(result.y).toBe(200);
  });

  it('pulls a position back from beyond the top left', () => {
    const result = clampToViewport(-500, -500, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('does not produce a negative bound when the widget is larger than the viewport', () => {
    const result = clampToViewport(-100, -100, 100, 100, 500, 500);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

describe('nearestCorner', () => {
  it('picks the corner the widget centre is closest to', () => {
    expect(nearestCorner(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT)).toBe('topLeft');
    expect(
      nearestCorner(700, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT),
    ).toBe('topRight');
    expect(
      nearestCorner(0, 600, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT),
    ).toBe('bottomLeft');
    expect(
      nearestCorner(700, 600, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT),
    ).toBe('bottomRight');
  });

  it('decides by the centre, not the top-left corner', () => {
    // The widget straddles the vertical midpoint but its centre is on the
    // right, so it belongs in the right-hand corner.
    const left = VIEWPORT_WIDTH / 2 - 10;
    expect(nearestCorner(left, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT)).toBe('topRight');
  });
});

describe('positionToMiniPosition', () => {
  it('converts a drop into a corner and an offset', () => {
    const anchor = cornerAnchor('topLeft', VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT);
    const position = positionToMiniPosition(
      anchor.x + 30,
      anchor.y + 40,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      WIDTH,
      HEIGHT,
    );

    expect(position.corner).toBe('topLeft');
    expect(position.offsetX).toBe(30);
    expect(position.offsetY).toBe(40);
  });

  it('records a negative offset when dropped inside the anchor', () => {
    const anchor = cornerAnchor('bottomRight', VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WIDTH, HEIGHT);
    const position = positionToMiniPosition(
      anchor.x - 20,
      anchor.y - 10,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      WIDTH,
      HEIGHT,
    );

    expect(position.corner).toBe('bottomRight');
    expect(position.offsetX).toBe(-20);
    expect(position.offsetY).toBe(-10);
  });

  it('round-trips through the anchor', () => {
    const position = positionToMiniPosition(
      300,
      200,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      WIDTH,
      HEIGHT,
    );
    const anchor = cornerAnchor(
      position.corner,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      WIDTH,
      HEIGHT,
    );

    expect(anchor.x + position.offsetX).toBe(300);
    expect(anchor.y + position.offsetY).toBe(200);
  });
});

describe('normalizeMiniPosition', () => {
  it('repairs an unknown corner to the default', () => {
    const position = normalizeMiniPosition({ corner: 'middle', offsetX: 5, offsetY: 5 });

    expect(position.corner).toBe(DEFAULT_MINI_POSITION.corner);
    expect(position.offsetX).toBe(5);
  });

  it('repairs non-numeric offsets to zero', () => {
    const position = normalizeMiniPosition({
      corner: 'topLeft',
      offsetX: 'nonsense',
      offsetY: null,
    });

    expect(position.offsetX).toBe(0);
    expect(position.offsetY).toBe(0);
  });

  it('falls back to the default for a value that is not an object', () => {
    expect(normalizeMiniPosition(null)).toEqual(DEFAULT_MINI_POSITION);
    expect(normalizeMiniPosition('corner')).toEqual(DEFAULT_MINI_POSITION);
  });

  it('keeps a valid position untouched', () => {
    const position = normalizeMiniPosition({
      corner: 'bottomLeft',
      offsetX: 12,
      offsetY: 34,
    });

    expect(position).toEqual({ corner: 'bottomLeft', offsetX: 12, offsetY: 34 });
  });
});

describe('isMiniCorner', () => {
  it('accepts the four known corners', () => {
    expect(isMiniCorner('topLeft')).toBe(true);
    expect(isMiniCorner('topRight')).toBe(true);
    expect(isMiniCorner('bottomLeft')).toBe(true);
    expect(isMiniCorner('bottomRight')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isMiniCorner('middle')).toBe(false);
    expect(isMiniCorner(42)).toBe(false);
    expect(isMiniCorner(undefined)).toBe(false);
  });
});

describe('reportedPositionToMiniPosition', () => {
  it('works out the corner the window was left in', () => {
    // The window is in the bottom right of a 1000 x 800 work area.
    const position = reportedPositionToMiniPosition({
      x: 1000 - WIDTH - MINI_MARGIN,
      y: 800 - HEIGHT - MINI_MARGIN,
      areaWidth: 1000,
      areaHeight: 800,
      width: WIDTH,
      height: HEIGHT,
    });

    expect(position).not.toBeNull();
    expect(position?.corner).toBe('bottomRight');
    expect(position?.offsetX).toBe(0);
    expect(position?.offsetY).toBe(0);
  });

  it('records the offset when the window was nudged away from the corner', () => {
    const position = reportedPositionToMiniPosition({
      x: 700,
      y: 600,
      areaWidth: 1000,
      areaHeight: 800,
      width: WIDTH,
      height: HEIGHT,
    });

    expect(position?.corner).toBe('bottomRight');
    expect(position?.offsetX).toBe(700 - (1000 - WIDTH - MINI_MARGIN));
    expect(position?.offsetY).toBe(600 - (800 - HEIGHT - MINI_MARGIN));
  });

  it('ignores a report that carries no usable area', () => {
    // A position relative to an unknown screen is not a position at all.
    const position = reportedPositionToMiniPosition({
      x: 10,
      y: 20,
      areaWidth: 0,
      areaHeight: 0,
      width: WIDTH,
      height: HEIGHT,
    });

    expect(position).toBeNull();
  });

  it('falls back to the nominal size when the window size is unknown', () => {
    const position = reportedPositionToMiniPosition({
      x: 16,
      y: 16,
      areaWidth: 1000,
      areaHeight: 800,
      width: 0,
      height: 0,
    });

    // The nominal size is 240 x 150, so the top left anchor is the margin.
    expect(position?.corner).toBe('topLeft');
    expect(position?.offsetX).toBe(0);
    expect(position?.offsetY).toBe(0);
  });
});
