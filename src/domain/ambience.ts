/**
 * The background sounds the app can play while a session runs.
 *
 * The ambience is *synthesised* at runtime rather than shipped as audio
 * files, for the same reason the completion cues are: it keeps the bundle
 * small, lets the volume be controlled precisely, and means an ambience
 * never fails to load. The catalogue here says which sounds exist and what
 * they are called; the synthesis lives in `src/lib/ambience.ts`.
 *
 * The identifiers are stored in the preferences, so they are part of a
 * persisted schema. An ambience that no longer exists falls back to `none`
 * rather than leaving the app playing silence the user did not ask for.
 */

/** The identifier of a background ambience. */
export type AmbienceId = 'none' | 'brown' | 'white' | 'rain' | 'waves' | 'fire' | 'forest';

/** One of the ambiences the user can choose from. */
export interface AmbienceOption {
  readonly id: AmbienceId;
  /** The name shown in the picker. */
  readonly label: string;
  /** A one-line description of how the ambience sounds. */
  readonly description: string;
}

/** Every ambience the app can play, in the order the picker lists them. */
export const AMBIENCE_OPTIONS: readonly AmbienceOption[] = [
  {
    id: 'none',
    label: 'None',
    description: 'No background sound.',
  },
  {
    id: 'brown',
    label: 'Brown noise',
    description: 'A deep, even rumble that masks the room.',
  },
  {
    id: 'white',
    label: 'White noise',
    description: 'A flat hiss that covers every frequency.',
  },
  {
    id: 'rain',
    label: 'Rain',
    description: 'A steady rain on a window.',
  },
  {
    id: 'waves',
    label: 'Ocean',
    description: 'Slow waves on a shore.',
  },
  {
    id: 'fire',
    label: 'Fireplace',
    description: 'A crackling fire.',
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'A quiet wood with birdsong.',
  },
];

/** The ambience a first-time user gets. */
export const DEFAULT_AMBIENCE: AmbienceId = 'none';

/** The identifiers of every ambience, derived from the catalogue. */
export const AMBIENCE_IDS: readonly AmbienceId[] = AMBIENCE_OPTIONS.map((option) => option.id);

/** The quietest and loudest the ambience may be played. */
export const MIN_AMBIENCE_VOLUME = 0;
export const MAX_AMBIENCE_VOLUME = 1;

/** The volume the ambience is played at by default. */
export const DEFAULT_AMBIENCE_VOLUME = 0.3;

/** Whether a value names one of the ambiences. */
export function isAmbienceId(value: unknown): value is AmbienceId {
  return typeof value === 'string' && (AMBIENCE_IDS as readonly string[]).includes(value);
}

/**
 * Repairs an arbitrary value into a usable ambience.
 *
 * An ambience that no longer exists falls back to the default rather than
 * leaving the app in a state it cannot describe.
 */
export function normalizeAmbienceId(value: unknown): AmbienceId {
  return isAmbienceId(value) ? value : DEFAULT_AMBIENCE;
}

/**
 * Clamps an ambience volume into the supported range.
 *
 * A volume outside the range is repaired rather than rejected, because a
 * corrupt number is a worse outcome than a slightly wrong one.
 */
export function clampAmbienceVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_AMBIENCE_VOLUME;
  }

  return Math.min(MAX_AMBIENCE_VOLUME, Math.max(MIN_AMBIENCE_VOLUME, volume));
}
