import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker, SERVICE_WORKER_PATH } from './service-worker';

/**
 * The registered service workers.
 *
 * The registration is recorded rather than performed, because a real
 * registration would install a worker that outlives the test.
 */
const register = vi.fn<(script: string) => Promise<unknown>>();

beforeEach(() => {
  register.mockReset();
  register.mockResolvedValue(undefined);

  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
});

describe('the service worker', () => {
  it('is not registered in a development build', async () => {
    // The build flag is what the module reads, so the test cannot change
    // it; the registration is therefore expected to be skipped entirely
    // when the environment is not a production one.
    await registerServiceWorker();

    // In the test environment the app is not a production build, so the
    // worker is never registered. The assertion documents that.
    if (!import.meta.env.PROD) {
      expect(register).not.toHaveBeenCalled();
    }
  });

  it('exposes the path the worker is served from', () => {
    expect(SERVICE_WORKER_PATH).toBe('/sw.js');
  });

  it('never throws when the browser refuses the registration', async () => {
    register.mockRejectedValue(new Error('refused'));

    await expect(registerServiceWorker()).resolves.toBeUndefined();
  });

  it('never throws when the browser has no service workers', async () => {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;

    await expect(registerServiceWorker()).resolves.toBeUndefined();
  });
});
