import { useEffect, useRef } from 'react';

import { setAmbienceVolume, startAmbience, stopAmbience } from '@/lib/ambience';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTimerStore } from '@/store/timer-store';

/**
 * Plays the background ambience while a session runs.
 *
 * **The ambience follows the timer, not the tab.** It starts when the timer
 * starts and stops when the timer stops, so a paused timer is a silent one
 * and an idle app makes no noise at all.
 *
 * The volume is applied to the running sound rather than restarting it: a
 * volume change that restarted the ambience would be audible, and a volume
 * change is not a change of ambience.
 *
 * The hook lives with the engine rather than with the settings panel,
 * because the panel is unmounted whenever the user is on another tab — and
 * an ambience that stopped when the user went to look at their task queue
 * would be an ambience that never played for the whole session.
 */
export function useAmbience(): void {
  const status = useTimerStore((store) => store.state.status);
  const phase = useTimerStore((store) => store.state.phase);
  const backgroundSound = usePreferencesStore((store) => store.preferences.backgroundSound);
  const backgroundVolume = usePreferencesStore((store) => store.preferences.backgroundVolume);
  const scope = usePreferencesStore((store) => store.preferences.ambienceScope);

  // The scope is what makes the ambience a *working* sound rather than a
  // background for the whole app: a user who chose rain to work under did
  // not necessarily choose it for the break.
  const inScope =
    scope === 'both' || (scope === 'focus' ? phase === 'work' : phase !== 'work');

  // The sound and the volume are read through a ref so that changing the
  // volume does not restart the sound. Only a *change of sound* restarts it.
  const volumeRef = useRef(backgroundVolume);
  useEffect(() => {
    volumeRef.current = backgroundVolume;
    setAmbienceVolume(backgroundVolume);
  }, [backgroundVolume]);

  useEffect(() => {
    if (status !== 'running' || backgroundSound === 'none' || !inScope) {
      stopAmbience();
      return;
    }

    startAmbience(backgroundSound, volumeRef.current);

    return () => {
      stopAmbience();
    };
  }, [status, backgroundSound, inScope]);
}
