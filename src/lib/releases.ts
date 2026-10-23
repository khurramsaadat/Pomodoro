/** Asking the internet whether a newer version of the app exists. */

import { APP_LATEST_RELEASE_API } from '@/domain/app-info';
import { normalizeAvailableUpdate, parseVersion, type AvailableUpdate } from '@/domain/updates';
import { createRepository } from '@/storage/repository';

/**
 * How long the question is allowed to take, in milliseconds.
 *
 * The answer is a nicety, not a requirement: a user whose machine is
 * offline, or behind a captive portal, or on a plane, gets an app that
 * works exactly as it did before and simply does not know about a release.
 * A request that hangs forever is worse than one that gives up, because
 * the only thing it buys is a stalled effect.
 */
const REQUEST_TIMEOUT_MS = 8000;

/** The key the last readable release is remembered under. */
const LATEST_RELEASE_KEY = 'pomodoro.latest-release';

/**
 * The last release the app could read.
 *
 * It is remembered for the same reason the app remembers anything: the
 * question is asked of a public service with a rate limit, and a start-up
 * that asks the question sixty times an hour from one shared address will
 * sometimes be told "no" for reasons that have nothing to do with a
 * release. The remembered answer is still a true answer, so the notice it
 * supports is still a true notice.
 */
const latestReleaseRepository = createRepository<AvailableUpdate | null>({
  key: LATEST_RELEASE_KEY,
  // The payload is validated rather than trusted: a stored answer that
  // does not read as a release is discarded rather than announced. The
  // shape is this repository's own, not GitHub's, so it is checked field
  // by field rather than through the repair.
  validate: (value) => {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const version = typeof record.version === 'string' ? record.version : null;
    const url = typeof record.url === 'string' ? record.url : null;

    if (version === null || url === null || !url.startsWith('https://')) {
      return null;
    }

    return parseVersion(version) === null ? null : { version, url };
  },
});

/**
 * The ETag of the last answer, so the next question can be conditional.
 *
 * A conditional request that comes back "not modified" is the cheapest
 * correct answer available: the app learns that nothing has changed
 * without shipping a body across the wire, and GitHub does not count it
 * against the rate limit.
 *
 * This is held in memory rather than in storage because it is a token for
 * one conversation with the server. A stored ETag that the server has
 * since forgotten costs a full response and nothing else.
 */
let cachedETag: string | null = null;

/**
 * The latest published release, or `null` when the app cannot know.
 *
 * Every failure falls back to the last release the app *did* read, and
 * only to `null` when there is nothing remembered either. A network error,
 * a rate limit, a 404 because no release has ever been published, and a
 * payload the app cannot read all mean the same thing to the caller:
 * either "the newest release I know of" or "nothing to announce".
 *
 * The request is `GET` with no credentials, so the app sends nothing about
 * the user anywhere. GitHub answers without an API key and allows any
 * origin to read the response, so both tiers can ask without a proxy of
 * their own.
 */
export async function fetchLatestRelease(): Promise<AvailableUpdate | null> {
  const remembered = latestReleaseRepository.read();

  try {
    const response = await fetch(APP_LATEST_RELEASE_API, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(cachedETag === null ? {} : { 'If-None-Match': cachedETag }),
      },
      // `AbortSignal.timeout` is not in every engine the app runs in, so
      // the signal is built only when it is available.
      ...(typeof AbortSignal.timeout === 'function'
        ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        : {}),
    });

    if (response.status === 304) {
      // Nothing changed since the last answer, so the remembered release is
      // the current one.
      return remembered;
    }

    const etag = response.headers.get('etag');
    if (etag !== null) {
      cachedETag = etag;
    }

    if (!response.ok) {
      return remembered;
    }

    const release = normalizeAvailableUpdate(await response.json());

    if (release !== null) {
      latestReleaseRepository.write(release);
    }

    return release ?? remembered;
  } catch {
    return remembered;
  }
}
