import { useEffect, useRef } from 'react';

import { playCompletionCue } from '@/lib/audio';
import { notifyCompletion } from '@/lib/notify';
import type { TimerPhase } from '@/domain/types';
import { platform } from '@/platform';
import { usePreferencesStore } from '@/store/preferences-store';

/**
 * Plays the completion cue, raises the notification, and keeps the desktop
 * tier's alarm in step.
 *
 * **The cue is played from two places, and only one of them is the timer.**
 *
 * The web tier's countdown is driven by the page, so the page notices the
 * deadline and plays the cue. The desktop tier has a *host* alarm as well:
 * a thread that sleeps until the same deadline and fires whether or not the
 * webview is being painted. That alarm is the reason the desktop tier can
 * notify a user whose window is in the background, and it was emitting an
 * event that nothing listened to — so the cue was played only by the page's
 * own tick, and a webview that had been throttled hard enough to miss the
 * deadline stayed silent.
 *
 * The two are de-duplicated by the *deadline*, which is the one thing they
 * agree on: it is the same `endsAt` the countdown is drawn from. The cue
 * is heard once per deadline, whichever clock notices it first.
 */
export function useCompletionSound(): void {
  const soundEnabled = usePreferencesStore((store) => store.preferences.soundEnabled);
  const completionSound = usePreferencesStore((store) => store.preferences.completionSound);
  const notificationsEnabled = usePreferencesStore(
    (store) => store.preferences.notificationsEnabled,
  );

  // The handler is held in a ref so that the subscription is registered
  // once, rather than being torn down and rebuilt every time the
  // preferences change.
  const cueRef = useRef<(phase: TimerPhase, endsAt: number) => void>(() => {});

  useEffect(() => {
    cueRef.current = (phase: TimerPhase, endsAt: number): void => {
      // The chime is a preference, not a fact about the timer: a user who
      // has turned the sound off should not hear it, even though the phase
      // still completes.
      if (soundEnabled) {
        playCompletionCue({ phase, endsAt, sound: completionSound });
      }

      // The notification is a preference in the same way. On the desktop
      // tier the host's own alarm raises it — this call is what covers the
      // browser tier, where there is no host to do it.
      if (notificationsEnabled) {
        notifyCompletion({ phase, endsAt });
      }
    };
  }, [soundEnabled, completionSound, notificationsEnabled]);

  // The host's alarm. It is the desktop tier's second opinion about the
  // same deadline, and it is the one that fires when the webview is not
  // being painted.
  useEffect(() => {
    platform.onAlarm((signal) => {
      cueRef.current(signal.phase, signal.endsAt);
    });
  }, []);
}
