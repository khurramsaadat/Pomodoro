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

import type { TimerPhase } from '@/domain/types';
import type { PlatformBridge, TrayStatus } from './types';
import { WEB_CAPABILITIES } from './types';

/**
 * Creates the web tier's bridge.
 *
 * The handlers are stored rather than invoked, because the web tier has no
 * way to raise them: there is no tray and no global shortcut. The handlers
 * are still accepted so the caller does not have to branch on the tier.
 */
export function createWebBridge(): PlatformBridge {
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

    setKeepAlive: (_keepAlive: boolean) => {
      // A browser tab cannot outlive its window.
    },

    hideWindow: () => {
      // A browser tab cannot be hidden to a notification area.
    },

    onToggleRequest: (_handler: () => void) => {
      // Nothing outside the page can reach it.
    },

    onShowRequest: (_handler: () => void) => {
      // Nothing outside the page can reach it.
    },

    onAlarm: (_handler: (phase: TimerPhase) => void) => {
      // The page's own deadline drives the countdown.
    },
  };
}
