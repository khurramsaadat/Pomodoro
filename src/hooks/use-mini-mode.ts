import { useEffect, useRef } from 'react';

import {
  DASHBOARD_HEIGHT,
  DASHBOARD_WIDTH,
  MINI_HEIGHT,
  MINI_WIDTH,
  reportedPositionToMiniPosition,
} from '@/domain/mini-mode';
import { platform } from '@/platform';
import { useMiniModeStore } from '@/store/mini-mode-store';

/**
 * Wires the mini timer to the host.
 *
 * This is the one place that knows *how* the mini timer is presented, and
 * the answer differs by tier:
 *
 *  - the native tier's own window becomes the mini timer, so the host is
 *    told to shrink it. The dashboard does not need hiding — the window
 *    *is* the widget, and there is nothing else on screen;
 *  - the web tier has no window of its own, so the widget is drawn inside
 *    the page and the page hides the dashboard itself.
 *
 * The app above this hook only ever says "mini mode is on" or "mini mode
 * is off", and never asks which tier it is on. The capability is the
 * sanctioned way to ask what the host *can* do.
 */
export function useMiniMode(): void {
  const enabled = useMiniModeStore((store) => store.enabled);
  const position = useMiniModeStore((store) => store.position);
  const setPosition = useMiniModeStore((store) => store.setPosition);

  // The host owns the presentation only when it can provide a window of
  // its own. The capability does not change during the app's life.
  const usesHostWindow = platform.capabilities.supportsMiniWindow;

  // The position is read through a ref so that the effect below is not torn
  // down and rebuilt every time the user nudges the widget.
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // The host is told to enter or to leave mini mode. The request carries
  // the placement, so the window comes back where the user left it.
  //
  // The placement is sent in *physical* pixels. The backend's view of the
  // screen is in physical pixels, and the backend cannot be trusted to
  // know the display's scale factor — on Windows the Rust process is not
  // per-monitor DPI-aware. The webview knows its own ratio exactly, so
  // the conversion happens here.
  useEffect(() => {
    if (!usesHostWindow) {
      return;
    }

    const current = positionRef.current;
    const scale = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;

    platform.setMiniWindow({
      active: enabled,
      corner: current.corner,
      offsetX: Math.round(current.offsetX * scale),
      offsetY: Math.round(current.offsetY * scale),
      width: Math.round(MINI_WIDTH * scale),
      height: Math.round(MINI_HEIGHT * scale),
      restoreWidth: Math.round(DASHBOARD_WIDTH * scale),
      restoreHeight: Math.round(DASHBOARD_HEIGHT * scale),
    });
  }, [enabled, usesHostWindow]);

  // The host reports where the user has dragged the window to, so the
  // position can be remembered. The report is in physical pixels, and it
  // is converted back to logical ones so that the stored position means
  // the same thing on a display with a different scale factor.
  useEffect(() => {
    if (!usesHostWindow) {
      return;
    }

    platform.onMiniWindowMoved((reported) => {
      const scale = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;

      const next = reportedPositionToMiniPosition({
        x: reported.x / scale,
        y: reported.y / scale,
        areaWidth: reported.areaWidth / scale,
        areaHeight: reported.areaHeight / scale,
        width: reported.width / scale,
        height: reported.height / scale,
      });

      if (next !== null) {
        setPosition(next);
      }
    });
  }, [setPosition, usesHostWindow]);
}
