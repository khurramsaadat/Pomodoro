import { useCallback, useEffect, useRef, useState } from 'react';

import { APP_VERSION } from '@/domain/app-info';
import { availableUpdate, type AvailableUpdate } from '@/domain/updates';
import { fetchLatestRelease } from '@/lib/releases';
import { updateDismissalRepository } from '@/storage/update-dismissal';

/** How often the app asks whether a newer version exists, in milliseconds. */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** What the update check knows at the moment. */
export interface UpdateCheck {
  /** The release to announce, or `null` when there is nothing to say. */
  readonly update: AvailableUpdate | null;
  /** Hides the notice for this version, and remembers that it was hidden. */
  readonly dismiss: () => void;
}

/**
 * Watches for a newer version of the app.
 *
 * The question is asked once when the app opens and then every few hours
 * while it runs, which covers both ways a session starts: a fresh launch,
 * and a window that has been left open across a release. The answer is
 * compared against the *build's* own version rather than anything the user
 * has stored, so a user who cleared their data is still told about a new
 * version.
 *
 * A dismissal is remembered by version rather than as a flag, and the
 * memory is read again on every check rather than once on mount: a user
 * who dismissed 0.2.0 must still be told about 0.3.0, and a dismissal made
 * in another window of the same app is honoured here.
 */
export function useUpdateCheck(): UpdateCheck {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  // The dismissed version is read once on mount and held in a ref, because
  // it is a fact about storage rather than about the render: re-reading it
  // on every render would ask localStorage for the same string sixty times
  // a second on a running countdown.
  const dismissedRef = useRef(updateDismissalRepository.read());

  useEffect(() => {
    let cancelled = false;

    const check = async (): Promise<void> => {
      const release = await fetchLatestRelease();

      if (cancelled) {
        return;
      }

      const available = availableUpdate(release, APP_VERSION);

      if (available === null || dismissedRef.current === available.version) {
        return;
      }

      setUpdate(available);
    };

    void check();

    const interval = window.setInterval(() => {
      void check();
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const dismiss = useCallback((): void => {
    setUpdate((current) => {
      if (current !== null) {
        dismissedRef.current = current.version;
        updateDismissalRepository.write(current.version);
      }
      return null;
    });
  }, []);

  return { update, dismiss };
}
