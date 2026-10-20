import { useEffect, useRef } from 'react';

import { miniModeRepository } from '@/storage/mini-mode';
import { useMiniModeStore } from '@/store/mini-mode-store';

/**
 * Restores and persists the mini timer's layout.
 *
 * The store is *subscribed* to rather than watched through render state, for
 * the same reason as the rest of the app: a render-driven effect would write
 * the value captured during the render that preceded the restore, wiping the
 * stored layout.
 *
 * The subscription is set up on every mount of the effect while the restore
 * runs only once, so React's StrictMode remount cannot leave the app without
 * persistence in development.
 */
export function useMiniModePersistence(): void {
  const restoredRef = useRef(false);

  useEffect(() => {
    const unsubscribe = useMiniModeStore.subscribe((state) => {
      miniModeRepository.write({ enabled: state.enabled, position: state.position });
    });

    if (!restoredRef.current) {
      restoredRef.current = true;
      useMiniModeStore.getState().restore();
    }

    return unsubscribe;
  }, []);
}
