/**
 * The platform bridge, chosen once for the lifetime of the app.
 *
 * The choice is made here rather than at each call site, so that no module
 * outside `src/platform` ever has to know which tier it is running on.
 *
 * The native bridge is loaded through a *dynamic* import, and only when the
 * page is running inside the Tauri webview. A static import of `tauri.ts`
 * would put the Tauri runtime into the web bundle, where it does not exist
 * and where it would break the standalone deploy.
 *
 * Because the import is asynchronous, the bridge exposed here is a *facade*.
 * It forwards to the real bridge once it has arrived, and buffers the
 * handlers that were registered in the meantime so that nothing is lost.
 */

import type { TimerPhase } from '@/domain/types';
import type {
  AlarmRequest,
  MiniModeRequest,
  MiniWindowPosition,
  PlatformBridge,
  PlatformCapabilities,
  TrayStatus,
  WorkArea,
} from './types';
import { WEB_CAPABILITIES } from './types';
import { createWebBridge } from './web';

/** Whether the page is running inside the Tauri webview. */
function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** The real bridge, once the native one has loaded. */
let active: PlatformBridge | null = null;

/** The handlers registered before the native bridge arrived. */
const pendingToggles: (() => void)[] = [];
const pendingShows: (() => void)[] = [];
const pendingAlarms: ((phase: TimerPhase) => void)[] = [];
const pendingMoved: ((position: MiniWindowPosition) => void)[] = [];

/**
 * The alarm that was asked for before the native bridge arrived.
 *
 * The alarm is *not* a notification that can be replayed later — it is a
 * deadline, and a deadline that is never sent is a phase that ends in
 * silence. The request is therefore held and sent as soon as the bridge
 * is ready.
 */
let pendingAlarm: AlarmRequest | null = null;

/** Whether an alarm is waiting to be sent. */
let pendingClear = false;

/**
 * The mini window request made before the bridge was ready.
 *
 * The request is held rather than dropped, because a mini window the user
 * asked for and never got is a button that appears to do nothing.
 */
let pendingMiniWindow: MiniModeRequest | null = null;

/**
 * The last tray status, held until the bridge is ready.
 *
 * The tray is updated on a timer, so it would catch up within a second
 * anyway — but a tooltip that is right immediately is better than one that
 * is briefly wrong.
 */
let pendingTray: TrayStatus | null = null;

/**
 * The capabilities, before the native bridge has been consulted.
 *
 * The native tier is reported optimistically, because the page *is* inside
 * the Tauri webview and the backend only refines the answer. The web tier
 * reports that it can do nothing native, which is the truth.
 */
const fallbackCapabilities: PlatformCapabilities = isNative()
  ? {
      native: true,
      supportsTray: true,
      supportsGlobalShortcut: true,
      supportsNotifications: true,
      supportsMiniWindow: true,
    }
  : WEB_CAPABILITIES;

/** Loads the native bridge, if this is the native tier. */
async function resolve(): Promise<void> {
  if (!isNative()) {
    active = createWebBridge();
    return;
  }

  try {
    const module = await import('./tauri');
    const bridge = module.createTauriBridge();
    active = bridge;

    // The handlers that arrived early are registered now, so the tray and
    // the shortcut are wired up from the first moment.
    for (const handler of pendingToggles) {
      bridge.onToggleRequest(handler);
    }
    for (const handler of pendingShows) {
      bridge.onShowRequest(handler);
    }
    for (const handler of pendingAlarms) {
      bridge.onAlarm(handler);
    }
    for (const handler of pendingMoved) {
      bridge.onMiniWindowMoved(handler);
    }
    pendingToggles.length = 0;
    pendingShows.length = 0;
    pendingAlarms.length = 0;
    pendingMoved.length = 0;

    // The alarm that was asked for before the bridge arrived is sent now.
    // A deadline that is never sent is a phase that ends in silence, so
    // the request is held rather than dropped.
    if (pendingAlarm !== null) {
      bridge.scheduleAlarm(pendingAlarm);
      pendingAlarm = null;
      pendingClear = false;
    } else if (pendingClear) {
      bridge.clearAlarm();
      pendingClear = false;
    }

    // The tray's last state is sent now, so the tooltip is right from the
    // first moment rather than a second later.
    if (pendingTray !== null) {
      bridge.updateTray(pendingTray);
      pendingTray = null;
    }

    // The mini window request made before the bridge arrived is sent now, so
    // the window is in the state the user asked for rather than the state it
    // happened to be in when the page loaded.
    if (pendingMiniWindow !== null) {
      bridge.setMiniWindow(pendingMiniWindow);
      pendingMiniWindow = null;
    }
  } catch {
    // The native modules could not be loaded: fall back to the web bridge
    // rather than leaving the app with no platform at all.
    active = createWebBridge();
  }
}

void resolve();

/** The bridge this app is using. */
export const platform: PlatformBridge = {
  get capabilities() {
    return active?.capabilities ?? fallbackCapabilities;
  },

  scheduleAlarm: (request) => {
    if (active) {
      active.scheduleAlarm(request);
      return;
    }
    // The request is held until the bridge is ready. A deadline that is
    // never sent is a phase that ends in silence.
    pendingAlarm = request;
    pendingClear = false;
  },

  clearAlarm: () => {
    if (active) {
      active.clearAlarm();
      return;
    }
    pendingAlarm = null;
    pendingClear = true;
  },

  updateTray: (status: TrayStatus) => {
    if (active) {
      active.updateTray(status);
      return;
    }
    pendingTray = status;
  },

  setKeepAlive: (keepAlive: boolean) => {
    active?.setKeepAlive(keepAlive);
  },

  hideWindow: () => {
    active?.hideWindow();
  },

  onToggleRequest: (handler: () => void) => {
    if (active) {
      active.onToggleRequest(handler);
      return;
    }
    pendingToggles.push(handler);
  },

  onShowRequest: (handler: () => void) => {
    if (active) {
      active.onShowRequest(handler);
      return;
    }
    pendingShows.push(handler);
  },

  onAlarm: (handler: (phase: TimerPhase) => void) => {
    if (active) {
      active.onAlarm(handler);
      return;
    }
    pendingAlarms.push(handler);
  },

  setMiniWindow: (request: MiniModeRequest) => {
    if (active) {
      active.setMiniWindow(request);
      return;
    }

    // The request is held until the bridge is ready. A mini window that was
    // asked for and never sent is a request the user believes was granted.
    pendingMiniWindow = request;
  },

  workArea: async (): Promise<WorkArea> => {
    if (active) {
      return active.workArea();
    }
    return { width: 0, height: 0 };
  },

  onMiniWindowMoved: (handler: (position: MiniWindowPosition) => void) => {
    if (active) {
      active.onMiniWindowMoved(handler);
      return;
    }
    pendingMoved.push(handler);
  },
};

export type {
  AlarmRequest,
  MiniModeRequest,
  MiniWindowPosition,
  PlatformBridge,
  PlatformCapabilities,
  TrayStatus,
  WorkArea,
} from './types';
export { WEB_CAPABILITIES } from './types';

