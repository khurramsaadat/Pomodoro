import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimerPhase } from '@/domain/types';

/**
 * The recorded calls to the Tauri runtime.
 *
 * The runtime is mocked rather than shelled out to, because the point of
 * these tests is the *wiring*: that the right command is invoked with the
 * right payload, and that an event from the backend reaches the right
 * handler.
 */
const invoke = vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>();
const listen = vi.fn<
  (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>
>();

/** The handlers the bridge registered, by event name. */
const handlers = new Map<string, (event: { payload: unknown }) => void>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (command: string, args?: Record<string, unknown>) => invoke(command, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(event, handler);
    return listen(event, handler);
  },
}));

/** Emits a backend event to the bridge. */
function emit(event: string, payload: unknown): void {
  handlers.get(event)?.({ payload });
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
  listen.mockReset();
  listen.mockResolvedValue(() => {});
  handlers.clear();

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    configurable: true,
  });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
});

/** Creates the bridge with the mocked runtime in place. */
async function createBridge() {
  const module = await import('./tauri');
  return module.createTauriBridge();
}

/**
 * Waits for the bridge's lazy import to settle.
 *
 * The bridge resolves its modules through a chain of promises, so the test
 * has to let a whole task run rather than just a few microtasks.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the Tauri platform bridge', () => {
  it('detects the native tier', async () => {
    const module = await import('./tauri');
    expect(module.isTauri()).toBe(true);
  });

  it('does not detect the native tier in a browser', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    const module = await import('./tauri');
    expect(module.isTauri()).toBe(false);
  });

  it('schedules the alarm against the deadline', async () => {
    const bridge = await createBridge();
    await settle();

    bridge.scheduleAlarm({ endsAt: 1_700_000_000_000, phase: 'work' });
    await settle();

    expect(invoke).toHaveBeenCalledWith('set_alarm', {
      payload: { endsAt: 1_700_000_000_000, phase: 'work' },
    });
  });

  it('clears the alarm', async () => {
    const bridge = await createBridge();
    await settle();

    bridge.clearAlarm();
    await settle();

    expect(invoke).toHaveBeenCalledWith('clear_alarm', undefined);
  });

  it('updates the tray', async () => {
    const bridge = await createBridge();
    await settle();

    bridge.updateTray({ phase: 'shortBreak', remaining: '04:59', running: false });
    await settle();

    expect(invoke).toHaveBeenCalledWith('set_tray_state', {
      state: { phase: 'shortBreak', remaining: '04:59', running: false },
    });
  });

  it('keeps the app alive when the window is closed', async () => {
    const bridge = await createBridge();
    await settle();

    bridge.setKeepAlive(true);
    await settle();

    expect(invoke).toHaveBeenCalledWith('set_keep_alive', { keepAlive: true });
  });

  it('hides the window', async () => {
    const bridge = await createBridge();
    await settle();

    bridge.hideWindow();
    await settle();

    expect(invoke).toHaveBeenCalledWith('hide_window', undefined);
  });

  it('forwards a toggle request from the tray', async () => {
    const bridge = await createBridge();
    await settle();

    const handler = vi.fn();
    bridge.onToggleRequest(handler);

    emit('pomodoro://toggle', null);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('forwards a show request from the tray', async () => {
    const bridge = await createBridge();
    await settle();

    const handler = vi.fn();
    bridge.onShowRequest(handler);

    emit('pomodoro://show', null);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('forwards the native alarm with its phase', async () => {
    const bridge = await createBridge();
    await settle();

    const handler = vi.fn<(phase: TimerPhase) => void>();
    bridge.onAlarm(handler);

    emit('pomodoro://alarm', 'work');

    expect(handler).toHaveBeenCalledWith('work');
  });

  it('never throws when the runtime is missing', async () => {
    // The bridge must survive a page that is not inside Tauri — for
    // instance when the web build is opened in a browser.
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

    const module = await import('./tauri');
    const bridge = module.createTauriBridge();
    await settle();

    expect(() => {
      bridge.scheduleAlarm({ endsAt: 1, phase: 'work' });
      bridge.clearAlarm();
      bridge.updateTray({ phase: 'work', remaining: '25:00', running: true });
      bridge.setKeepAlive(true);
      bridge.hideWindow();
    }).not.toThrow();
  });
});
