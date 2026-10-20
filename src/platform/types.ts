/**
 * The seam between the web tier and the native tier.
 *
 * Everything the app can ask of its host is described here, in terms the
 * domain layer understands. The web implementation answers "no" to all of
 * it; the Tauri implementation answers "yes" to the parts the desktop can
 * do.
 *
 * The interface is deliberately small. A seam that grows a method per
 * feature stops being a seam and becomes a second copy of the app.
 */

import type { MiniCorner } from '@/domain/mini-mode';
import type { TimerPhase } from '@/domain/types';

/** What the host tier is able to do. */
export interface PlatformCapabilities {
  /** Whether the app is running in the native desktop tier. */
  readonly native: boolean;
  /** Whether the window can be hidden to the system tray. */
  readonly supportsTray: boolean;
  /** Whether a global keyboard shortcut can be registered. */
  readonly supportsGlobalShortcut: boolean;
  /** Whether the tier can raise a system notification. */
  readonly supportsNotifications: boolean;
  /**
   * Whether the host provides its own mini window.
   *
   * A desktop host can turn the app's own window into a small frameless
   * widget, which is a better mini timer than one drawn inside a page: it
   * can sit above other windows and be moved by the operating system. A
   * browser cannot, so the web tier draws the mini timer itself.
   */
  readonly supportsMiniWindow: boolean;
}

/** The capabilities of a tier that can do nothing native. */
export const WEB_CAPABILITIES: PlatformCapabilities = {
  native: false,
  supportsTray: false,
  supportsGlobalShortcut: false,
  supportsNotifications: false,
  supportsMiniWindow: false,
};

/** The area of the screen a window may be placed in, in logical pixels. */
export interface WorkArea {
  /** The width of the work area. */
  readonly width: number;
  /** The height of the work area. */
  readonly height: number;
}

/**
 * A request to enter or to leave mini mode.
 *
 * The placement is expressed as a corner plus an offset, which is the same
 * model the app uses to remember where the widget was left. The host owns
 * the screen, so it does the arithmetic that turns a corner into a real
 * position — the app never has to know how large the display is.
 *
 * Every measurement is in *physical* pixels. The host's view of the screen
 * is in physical pixels, and the host cannot be trusted to know the
 * display's scale factor: on Windows the desktop process is not
 * per-monitor DPI-aware, so it would report a scale factor of one while
 * the webview inside it is drawn at one and a half. The webview knows its
 * own ratio exactly, so the app does the conversion and the host only does
 * the arithmetic.
 */
export interface MiniModeRequest {
  /** Whether the host should be in mini mode. */
  readonly active: boolean;
  /** The corner the window is anchored to. */
  readonly corner: MiniCorner;
  /** Horizontal offset from the corner's anchor, in physical pixels. */
  readonly offsetX: number;
  /** Vertical offset from the corner's anchor, in physical pixels. */
  readonly offsetY: number;
  /** The width of the mini window, in physical pixels. */
  readonly width: number;
  /** The height of the mini window, in physical pixels. */
  readonly height: number;
  /** The width the dashboard is restored to, in physical pixels. */
  readonly restoreWidth: number;
  /** The height the dashboard is restored to, in physical pixels. */
  readonly restoreHeight: number;
}

/**
 * Where the host's window ended up.
 *
 * The host reports the new position after the user has dragged the window,
 * so the app can remember it for next time. Every measurement is in
 * *physical* pixels, for the same reason as the request.
 */
export interface MiniWindowPosition {
  /** The left edge of the window, relative to the work area. */
  readonly x: number;
  /** The top edge of the window, relative to the work area. */
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

/** A request to raise a notification at a deadline. */
export interface AlarmRequest {
  /** The deadline the alarm fires at, in epoch milliseconds. */
  readonly endsAt: number;
  /** The phase that is ending. */
  readonly phase: TimerPhase;
}

/** The state the tray shows for the timer. */
export interface TrayStatus {
  /** The phase currently running. */
  readonly phase: TimerPhase;
  /** The formatted time left, such as `24:58`. */
  readonly remaining: string;
  /** Whether the timer is running. */
  readonly running: boolean;
}

/**
 * The host services the app may use.
 *
 * Every method must be safe to call on a tier that cannot honour it: the
 * web implementation does nothing at all rather than throwing, so the
 * caller never has to ask which tier it is on before using the bridge.
 */
export interface PlatformBridge {
  /** What the host tier can do. */
  readonly capabilities: PlatformCapabilities;

  /**
   * Schedules a notification for a phase deadline.
   *
   * A second call replaces the first, so the caller can schedule on every
   * state change without cancelling first.
   */
  scheduleAlarm(request: AlarmRequest): void;

  /** Cancels any scheduled notification. */
  clearAlarm(): void;

  /** Updates the tray's view of the timer. */
  updateTray(status: TrayStatus): void;

  /**
   * Sets whether closing the window hides it instead of quitting.
   *
   * This is what keeps the timer alive when the user closes the window.
   */
  setKeepAlive(keepAlive: boolean): void;

  /**
   * Hides the window to the system tray.
   *
   * A browser tab cannot be hidden, so this is a no-op on the web tier.
   */
  hideWindow(): void;

  /**
   * Registers a handler for a request to start or pause the timer.
   *
   * The handler is called from outside the window — the tray menu or the
   * global shortcut — so it is the only way the app can be driven while
   * the window is hidden.
   */
  onToggleRequest(handler: () => void): void;

  /**
   * Registers a handler for a request to show the window.
   */
  onShowRequest(handler: () => void): void;

  /**
   * Registers a handler for the native alarm firing.
   *
   * The native alarm is the host's own timer, so the host can raise a
   * notification even when the webview is not being painted. The handler
   * lets the app react in step with it.
   */
  onAlarm(handler: (phase: TimerPhase) => void): void;

  /**
   * Asks the host to show or to hide the mini window.
   *
   * On the native tier this *replaces* the app's main window with a small
   * frameless one, so the full dashboard is genuinely gone rather than
   * covered by a widget. On the web tier it does nothing, because the web
   * tier draws its own mini timer inside the page.
   */
  setMiniWindow(request: MiniModeRequest): void;

  /**
   * The area of the screen the host's window may be placed in.
   *
   * The web tier reports the size of the browser viewport, which is the
   * closest thing it has to a screen. The answer is a promise because the
   * native tier has to ask the operating system.
   */
  workArea(): Promise<WorkArea>;

  /**
   * Registers a handler for the host reporting where the window was moved.
   *
   * The native host knows where the user has dragged the window to; the web
   * tier knows where the widget was dropped. Either way the app is told, so
   * the position can be remembered for next time.
   */
  onMiniWindowMoved(handler: (position: MiniWindowPosition) => void): void;
}
