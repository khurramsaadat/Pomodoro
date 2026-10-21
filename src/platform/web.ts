/**
 * The web tier's implementation of the platform bridge.
 *
 * Everything here does nothing, and that is the point: the web build must
 * contain no Tauri code at all, and the app must not need to know which tier
 * it is on. A call to `scheduleAlarm` in a browser is a no-op rather than an
 * error, so the caller can schedule unconditionally.
 *
 * This module must never import `@tauri-apps/api` — not even dynamically.
 * The dynamic import lives in `tauri.ts` and nowhere else.
 */

import type { AlarmSignal } from '@/domain/types';
import type {
  MiniModeRequest,
  MiniWindowPosition,
  PlatformBridge,
  TrayStatus,
  WorkArea,
} from './types';
import { WEB_CAPABILITIES } from './types';

/**
 * Creates the web tier's bridge.
 *
 * The handlers are stored rather than invoked, because the web tier has no
 * way to raise them: there is no tray and no global shortcut. The handlers
 * are still accepted so the caller does not have to branch on the tier.
 */
export function createWebBridge(): PlatformBridge {
  /** The handlers, held so a late subscription still reaches them. */
  const movedHandlers = new Set<(position: MiniWindowPosition) => void>();

  return {
    capabilities: WEB_CAPABILITIES,

    scheduleAlarm: () => {
      // A browser has no reliable background timer, so there is nothing to
      // schedule against. The in-page deadline already handles the visible
      // case.
    },

    clearAlarm: () => {
      // Nothing was scheduled.
    },

    updateTray: (_status: TrayStatus) => {
      // There is no tray.
    },

    setAlwaysOnTop: (_alwaysOnTop: boolean) => {
      // A browser tab has no z-order: the browser decides what is on top.
    },

    onToggleRequest: (_handler: () => void) => {
      // Nothing outside the page can reach it.
    },

    onShowRequest: (_handler: () => void) => {
      // Nothing outside the page can reach it.
    },

    onAlarm: (_handler: (signal: AlarmSignal) => void) => {
      // The page's own deadline drives the countdown.
    },

    setMiniWindow: (_request: MiniModeRequest) => {
      // The web tier has no window of its own to shrink. The mini timer is
      // drawn inside the page instead, and the page decides for itself what
      // to show.
    },

    workArea: (): Promise<WorkArea> =>
      Promise.resolve({
        // The viewport is the browser's closest equivalent of a screen, and
        // it is what the in-page widget is positioned against.
        width: typeof window === 'undefined' ? 0 : window.innerWidth,
        height: typeof window === 'undefined' ? 0 : window.innerHeight,
      }),

    onMiniWindowMoved: (handler: (position: MiniWindowPosition) => void) => {
      // The web tier has no window to move, but the in-page widget reports
      // where it was dropped through the same channel, so the app only has
      // to remember the position in one place.
      movedHandlers.add(handler);
    },
  };
}
