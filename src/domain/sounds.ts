/**
 * The completion sounds the app can play.
 *
 * The cues are synthesised at runtime rather than shipped as audio files, so
 * the catalogue is a list of *identifiers* and the synthesis lives in
 * `src/lib/audio.ts`. Keeping the two apart means the domain can say which
 * sounds exist and what they are called, without knowing anything about the
 * Web Audio API.
 *
 * The identifiers are stored in the preferences, so they are part of a
 * persisted schema: renaming one would silently reset a user's choice. A
 * sound that no longer exists falls back to the default rather than leaving
 * the app without a cue.
 */

/** The identifier of a completion sound. */
export type SoundId = 'chime' | 'bell' | 'pulse' | 'digital';

/** One of the sounds the user can choose from. */
export interface SoundOption {
  readonly id: SoundId;
  /** The name shown in the picker. */
  readonly label: string;
  /** A one-line description of how the sound sounds. */
  readonly description: string;
}

/** Every sound the app can play, in the order the picker lists them. */
export const SOUND_OPTIONS: readonly SoundOption[] = [
  {
    id: 'chime',
    label: 'Chime',
    description: 'A soft two-note chime.',
  },
  {
    id: 'bell',
    label: 'Bell',
    description: 'A struck bell with a long decay.',
  },
  {
    id: 'pulse',
    label: 'Pulse',
    description: 'A muted electronic blip.',
  },
  {
    id: 'digital',
    label: 'Digital',
    description: 'A bright four-step arpeggio.',
  },
];

/** The sound a first-time user gets. */
export const DEFAULT_SOUND: SoundId = 'chime';

/** The identifiers of every sound, derived from the catalogue. */
export const SOUND_IDS: readonly SoundId[] = SOUND_OPTIONS.map((option) => option.id);

/** Whether a value names one of the sounds. */
export function isSoundId(value: unknown): value is SoundId {
  return typeof value === 'string' && (SOUND_IDS as readonly string[]).includes(value);
}

/**
 * Repairs an arbitrary value into a usable sound.
 *
 * A sound that no longer exists — because the catalogue changed, or because
 * the payload was written by a different build — falls back to the default
 * rather than leaving the user with no cue at all.
 */
export function normalizeSoundId(value: unknown): SoundId {
  return isSoundId(value) ? value : DEFAULT_SOUND;
}
