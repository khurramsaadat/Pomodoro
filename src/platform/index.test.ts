import { afterEach, describe, expect, it, vi } from 'vitest';

import type { platform } from './index';

/**
 * The native bridge is loaded through a dynamic import, so the module that
 * selects it has to be re-imported for each test with a different tier.
 */
async function loadPlatform(native: boolean): Promise<typeof platform> {
  vi.resetModules();

  if (native) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  }

  const module = await import('./index');
  return module.platform;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
});

describe('the platform bridge', () => {
  it('reports the web tier in a browser', async () => {
    const bridge = await loadPlatform(false);

    expect(bridge.capabilities.native).toBe(false);
    expect(bridge.capabilities.supportsTray).toBe(false);
    expect(bridge.capabilities.supportsGlobalShortcut).toBe(false);
  });

  it('reports the native tier inside the Tauri webview', async () => {
    const bridge = await loadPlatform(true);

    expect(bridge.capabilities.native).toBe(true);
    expect(bridge.capabilities.supportsTray).toBe(true);
    expect(bridge.capabilities.supportsGlobalShortcut).toBe(true);
  });

  it('never throws when the web tier is asked to do native things', async () => {
    const bridge = await loadPlatform(false);

    expect(() => {
      bridge.scheduleAlarm({ endsAt: 1_000, phase: 'work' });
      bridge.clearAlarm();
      bridge.updateTray({ phase: 'work', remaining: '25:00', running: true });
      bridge.setKeepAlive(true);
      bridge.hideWindow();
    }).not.toThrow();
  });

  it('keeps a handler registered before the bridge has loaded', async () => {
    const bridge = await loadPlatform(false);
    const handler = vi.fn();

    // The handler is registered before any bridge exists. It must be held
    // rather than dropped, because the native bridge arrives later.
    bridge.onToggleRequest(handler);
    bridge.onShowRequest(handler);
    bridge.onAlarm(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('holds the alarm until the bridge is ready', async () => {
    const bridge = await loadPlatform(false);

    // The alarm is a deadline. One that is never sent is a phase that ends
    // in silence, so the request has to survive the bridge's arrival.
    expect(() => {
      bridge.scheduleAlarm({ endsAt: 1_700_000_000_000, phase: 'work' });
    }).not.toThrow();

    expect(() => {
      bridge.clearAlarm();
    }).not.toThrow();
  });
});
