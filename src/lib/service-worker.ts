/**
 * Registration of the service worker that makes the web build installable
 * and usable offline.
 *
 * The worker is registered only in a production build: during development
 * it would serve a stale shell over the dev server, which is a
 * particularly confusing way to lose an afternoon.
 *
 * Registration never throws and never blocks. A browser that does not
 * support service workers, a page served over `file://`, and a browser
 * that refuses the registration for policy reasons are all ordinary
 * outcomes, not errors.
 */

/** The path the service worker is served from. */
export const SERVICE_WORKER_PATH = '/sw.js';

/** Whether the app is running from a production build. */
function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Registers the service worker.
 *
 * Returns a promise that resolves once the registration has been attempted,
 * so a caller can wait for it without caring about the outcome.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!isProduction() || typeof navigator === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  // A page opened straight from the filesystem has no origin to register
  // against, and the call throws a TypeError.
  if (window.location.protocol === 'file:') {
    return;
  }

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  } catch {
    // The app works perfectly well without a service worker; it simply
    // will not be available offline.
  }
}
