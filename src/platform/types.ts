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
}

/** The capabilities of a tier that can do nothing native. */
export const WEB_CAPABILITIES: PlatformCapabilities = {
  native: false,
  supportsTray: false,
  supportsGlobalShortcut: false,
  supportsNotifications: false,
};

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
}
