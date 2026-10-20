/**
 * A small, versioned repository over `localStorage`.
 *
 * Every persisted payload carries a schema version so that a future change
 * to the shape of the data can migrate — or discard — what is stored instead
 * of crashing the app. Validation is the second line of defence: a payload
 * that fails validation is discarded rather than trusted.
 *
 * The repository never throws. Storage can be unavailable (private mode, a
 * sandboxed iframe, a full quota) and the app must keep working without
 * persistence, so every operation degrades to a no-op.
 */

/** The version stamped onto every payload written by this build. */
export const STORAGE_SCHEMA_VERSION = 1;

/** The envelope every persisted payload is wrapped in. */
export interface Versioned<T> {
  readonly version: number;
  readonly data: T;
}

/** A repository for one logical piece of persisted data. */
export interface Repository<T> {
  /** Reads the stored value, or `null` when there is nothing valid stored. */
  read(): T | null;
  /** Writes a value, replacing anything stored before. */
  write(value: T): void;
  /** Removes the stored value. */
  clear(): void;
}

export interface RepositoryOptions<T> {
  /** The storage key this repository owns. */
  readonly key: string;
  /**
   * Validates an untrusted value.
   *
   * Returning `null` means the value is unusable and is discarded.
   */
  readonly validate: (value: unknown) => T | null;
  /**
   * Migrates a payload written by an older schema version.
   *
   * Returning `null` discards the payload. The default keeps payloads that
   * are already at the current version and drops everything else.
   */
  readonly migrate?: (value: unknown, fromVersion: number) => T | null;
}

/** Whether a value is a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Creates a repository over a storage key.
 *
 * The repository is intentionally tiny: the interesting behaviour is the
 * version check and the validation, not the plumbing.
 */
export function createRepository<T>(options: RepositoryOptions<T>): Repository<T> {
  const { key, validate, migrate } = options;

  return {
    read: () => {
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return null;
      }

      if (raw === null) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }

      if (!isRecord(parsed)) {
        return null;
      }

      const version = typeof parsed.version === 'number' ? parsed.version : 0;

      if (version !== STORAGE_SCHEMA_VERSION) {
        if (!migrate) {
          return null;
        }
        return migrate(parsed.data, version);
      }

      return validate(parsed.data);
    },

    write: (value: T) => {
      try {
        const payload: Versioned<T> = { version: STORAGE_SCHEMA_VERSION, data: value };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // Storage can be full or unavailable; the app keeps working in memory.
      }
    },

    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore.
      }
    },
  };
}
