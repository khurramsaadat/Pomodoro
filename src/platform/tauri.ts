/**
 * The native tier's implementation of the platform bridge.
 *
 * This is the **only** module in the app that touches `@tauri-apps/api`, and
 * it does so through dynamic imports. A static import would pull the Tauri
 * runtime into the web build, where `window.__TAURI_INTERNALS__` does not
 * exist and the app would fail on its first call.
 *
 * The dynamic import is resolved once and cached, so a page that calls
 * `scheduleAlarm` on every tick pays for the module once rather than on
 * every call.
 */

import type { TimerPhase } from '@/domain/types';
import type {
  MiniWindowPosition,
  PlatformBridge,
  PlatformCapabilities,
  TrayStatus,
  WorkArea,
} from './types';

/** The event the backend emits when the tray or the shortcut asks for a toggle. */
const TOGGLE_EVENT = 'pomodoro://toggle';

/** The event the backend emits when the tray asks for the window to be shown. */
const SHOW_EVENT = 'pomodoro://show';

/** The event the backend emits when the native alarm fires. */
const ALARM_EVENT = 'pomodoro://alarm';

/** The event the backend emits when the window has been moved. */
const MOVED_EVENT = 'pomodoro://moved';

/**
 * Whether the app is running inside the Tauri webview.
 *
 * Tauri injects `__TAURI_INTERNALS__` into the page it loads, and it is the
 * only reliable signal: the user agent is not distinguishable, and the
 * window's own properties are not a contract.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** The Tauri modules the bridge needs, resolved lazily. */
interface TauriModules {
  readonly invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
  readonly listen: (
    event: string,
    handler: (event: { payload: unknown }) => void,
  ) => Promise<() => void>;
}

/**
 * Resolves the Tauri modules, or `null` when the app is not native.
 *
 * The import is written as a literal so the bundler can find it, but it is
 * only ever *executed* in the native tier.
 */
async function loadModules(): Promise<TauriModules | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    const [core, event] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ]);

    return {
      invoke: core.invoke,
      listen: event.listen,
    };
  } catch {
    // The runtime is present but the modules are not: treat it as the web.
    return null;
  }
}

/**
 * The work area the native window may be placed in.
 *
 * The backend knows the real work area — the screen minus the taskbar —
 * and it knows the scale factor, so the numbers it returns are already in
 * logical pixels. That matters: a placement computed in physical pixels
 * would land in the wrong place on a scaled display.
 *
 * A failure is not fatal. A zero-sized area means the host cannot place
 * the window, and the app carries on with the placement it already has.
 */
async function fetchWorkArea(
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>,
): Promise<WorkArea> {
  try {
    const info = (await invoke('work_area')) as Partial<WorkArea> | null;

    if (info && typeof info.width === 'number' && typeof info.height === 'number') {
      return { width: info.width, height: info.height };
    }
  } catch {
    // The command is not available; the fallbacks below stand.
  }

  return { width: 0, height: 0 };
}

/**
 * Creates the native tier's bridge.
 *
 * The bridge is created immediately, but the Tauri modules are resolved
 * lazily and in the background. Every method therefore has to tolerate the
 * modules not being ready yet, which is why they are all fire-and-forget:
 * a tray update that arrives a moment late is correct, and a timer that
 * waited on a promise would be worse.
 */
export function createTauriBridge(): PlatformBridge {
  let modules: Promise<TauriModules | null> | null = null;

  /** The capabilities, which the backend reports authoritatively. */
  let capabilities: PlatformCapabilities = {
    native: true,
    supportsTray: true,
    supportsGlobalShortcut: true,
    supportsNotifications: true,
    supportsMiniWindow: true,
  };

  /** The handlers, held so a late subscription still reaches them. */
  const toggleHandlers = new Set<() => void>();
  const showHandlers = new Set<() => void>();
  const alarmHandlers = new Set<(phase: TimerPhase) => void>();
  const movedHandlers = new Set<(position: MiniWindowPosition) => void>();

  /** Resolves the modules once. */
  const ready = (): Promise<TauriModules | null> => {
    modules ??= loadModules();
    return modules;
  };

  /**
   * Asks the backend what it can do.
   *
   * The answer is used rather than assumed, because the backend knows
   * whether the platform actually supports the tray — a Linux build without
   * a tray is a real thing.
   */
  const loadCapabilities = async (): Promise<void> => {
    const api = await ready();
    if (!api) {
      capabilities = {
        native: false,
        supportsTray: false,
        supportsGlobalShortcut: false,
        supportsNotifications: false,
        supportsMiniWindow: false,
      };
      return;
    }

    try {
      const info = (await api.invoke('platform_info')) as Partial<PlatformCapabilities> | null;
      if (info) {
        capabilities = {
          native: info.native ?? true,
          supportsTray: info.supportsTray ?? false,
          supportsGlobalShortcut: info.supportsGlobalShortcut ?? false,
          supportsNotifications: info.supportsTray ?? false,
          supportsMiniWindow: info.supportsMiniWindow ?? false,
        };
      }
    } catch {
      // The command is not available; the defaults above stand.
    }
  };

  void loadCapabilities();

  /** Subscribes to a backend event and forwards it to the handlers. */
  const subscribe = (event: string, handler: (payload: unknown) => void): void => {
    void ready().then((api) => {
      if (!api) {
        return;
      }
      void api.listen(event, (received) => handler(received.payload)).catch(() => {
        // A failed subscription is not fatal; the feature simply does not
        // work on this tier.
      });
    });
  };

  subscribe(TOGGLE_EVENT, () => {
    for (const handler of toggleHandlers) {
      handler();
    }
  });

  subscribe(SHOW_EVENT, () => {
    for (const handler of showHandlers) {
      handler();
    }
  });

  subscribe(ALARM_EVENT, (payload) => {
    for (const handler of alarmHandlers) {
      handler(payload as TimerPhase);
    }
  });

  subscribe(MOVED_EVENT, (payload) => {
    for (const handler of movedHandlers) {
      handler(payload as MiniWindowPosition);
    }
  });

  /** Invokes a backend command, swallowing any failure. */
  const send = (command: string, args?: Record<string, unknown>): void => {
    void ready().then((api) => {
      if (!api) {
        return;
      }
      void api.invoke(command, args).catch((error: unknown) => {
        // A failed command must never interrupt the timer, but it is worth
        // knowing about when the app is being debugged.
        console.warn(`[platform] the ${command} command failed`, error);
      });
    });
  };

  return {
    get capabilities() {
      return capabilities;
    },

    scheduleAlarm: (request) => {
      send('set_alarm', {
        payload: {
          endsAt: request.endsAt,
          phase: request.phase,
        },
      });
    },

    clearAlarm: () => {
      send('clear_alarm');
    },

    updateTray: (status: TrayStatus) => {
      send('set_tray_state', { state: status });
    },

    setKeepAlive: (keepAlive: boolean) => {
      send('set_keep_alive', { keepAlive });
    },

    hideWindow: () => {
      // The window is owned by the backend, so the hide is a command. The
      // command also sets the keep-alive flag, so the timer survives the
      // window going away.
      send('hide_window');
    },

    onToggleRequest: (handler: () => void) => {
      toggleHandlers.add(handler);
    },

    onShowRequest: (handler: () => void) => {
      showHandlers.add(handler);
    },

    onAlarm: (handler: (phase: TimerPhase) => void) => {
      alarmHandlers.add(handler);
    },

    setMiniWindow: (request) => {
      // The command is what actually resizes and re-styles the window, so
      // the placement is sent as a single request rather than as a series
      // of window calls that could be seen half-applied.
      send('set_mini_window', {
        request: {
          active: request.active,
          corner: request.corner,
          offsetX: request.offsetX,
          offsetY: request.offsetY,
          width: request.width,
          height: request.height,
          restoreWidth: request.restoreWidth,
          restoreHeight: request.restoreHeight,
        },
      });
    },

    workArea: async () => {
      // The work area comes from the operating system, so the answer is a
      // promise. A failure is not fatal: a zero-sized area simply means the
      // host cannot place the window, and the app carries on.
      const api = await ready();
      return api ? fetchWorkArea(api.invoke) : { width: 0, height: 0 };
    },

    onMiniWindowMoved: (handler: (position: MiniWindowPosition) => void) => {
      movedHandlers.add(handler);
    },
  };
}
