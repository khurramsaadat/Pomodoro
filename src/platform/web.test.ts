import { describe, expect, it, vi } from 'vitest';

import { createWebBridge } from './web';
import { WEB_CAPABILITIES } from './types';

describe('the web platform bridge', () => {
  it('reports that it can do nothing native', () => {
    const bridge = createWebBridge();

    expect(bridge.capabilities).toEqual(WEB_CAPABILITIES);
    expect(bridge.capabilities.native).toBe(false);
    expect(bridge.capabilities.supportsTray).toBe(false);
    expect(bridge.capabilities.supportsGlobalShortcut).toBe(false);
    expect(bridge.capabilities.supportsNotifications).toBe(false);
    expect(bridge.capabilities.supportsMiniWindow).toBe(false);
    expect(bridge.capabilities.supportsAlwaysOnTop).toBe(false);
  });

  it('accepts every call without throwing', () => {
    const bridge = createWebBridge();

    // The point of the web bridge is that a caller never has to ask which
    // tier it is on. Every method must be safe to call.
    expect(() => {
      bridge.scheduleAlarm({ endsAt: 1_000, phase: 'work' });
      bridge.clearAlarm();
      bridge.updateTray({ phase: 'work', remaining: '25:00', running: true });
      bridge.setAlwaysOnTop(true);
      bridge.setMiniWindow({
        active: true,
        corner: 'bottomRight',
        offsetX: 0,
        offsetY: 0,
        width: 240,
        height: 150,
        restoreWidth: 1180,
        restoreHeight: 820,
        alwaysOnTop: false,
      });
      bridge.onToggleRequest(() => {});
      bridge.onShowRequest(() => {});
      bridge.onAlarm(() => {});
      bridge.onMiniWindowMoved(() => {});
    }).not.toThrow();
  });

  it('reports the viewport as its work area', async () => {
    const bridge = createWebBridge();

    // The browser's viewport is the closest thing it has to a screen.
    const area = await bridge.workArea();

    expect(area.width).toBe(window.innerWidth);
    expect(area.height).toBe(window.innerHeight);
  });

  it('never invokes a registered handler', () => {
    const bridge = createWebBridge();
    const toggle = vi.fn();
    const show = vi.fn();
    const alarm = vi.fn();

    bridge.onToggleRequest(toggle);
    bridge.onShowRequest(show);
    bridge.onAlarm(alarm);

    // There is no tray and no global shortcut on the web, so nothing can
    // ever reach the handlers.
    expect(toggle).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(alarm).not.toHaveBeenCalled();
  });
});
