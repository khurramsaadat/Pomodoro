/**
 * Knowing that a newer version of the app exists.
 *
 * The comparison is pure and lives in the domain layer for the usual reason:
 * "is 0.2.0 newer than 0.1.0?" is a question about two strings, and a
 * question about two strings should be answerable without a network, a
 * browser, or a clock. The fetch lives in `src/lib/releases.ts`, and the
 * banner that shows the answer lives in the layout.
 *
 * A version here is a dotted run of numbers with an optional leading `v`,
 * which is how release tags are written. Anything after the numbers is
 * ignored: `0.2.0-beta` is read as `0.2.0`, because a pre-release is not a
 * version the app should nag its user about.
 */

/** A release the app has been told about, in the shape the banner needs. */
export interface AvailableUpdate {
  /** The released version, without its leading `v`. */
  readonly version: string;
  /** Where the release can be read about and downloaded. */
  readonly url: string;
}

/**
 * How many parts of a version are compared.
 *
 * Four is more than any release will use, and it puts a ceiling on the work
 * a tag can ask for.
 */
const MAX_VERSION_PARTS = 4;

/**
 * Reads a version into its numeric parts.
 *
 * Returning `null` means the value is not a version at all, which is a
 * different answer from "an old version" and has to stay different: a tag
 * that cannot be read is a release the app knows nothing about.
 */
export function parseVersion(value: string): readonly number[] | null {
  const trimmed = value.trim().replace(/^v/i, '');

  // Only the leading run of digits and dots is the version. A pre-release
  // or a build suffix (`-beta.1`, `+42`) is a label about the release, not
  // part of the number that orders it.
  const release = /^[\d.]+/.exec(trimmed)?.[0];

  if (release === undefined || release.length === 0) {
    return null;
  }

  return release
    .split('.')
    .slice(0, MAX_VERSION_PARTS)
    .map((part) => {
      const digits = /^(\d+)/.exec(part);
      return digits === null ? 0 : Number(digits[1]);
    });
}

/** Compares two versions: negative when left is older, 0 when they match. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left) ?? [0];
  const b = parseVersion(right) ?? [0];
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const l = a[index] ?? 0;
    const r = b[index] ?? 0;
    if (l !== r) {
      return l < r ? -1 : 1;
    }
  }

  return 0;
}

/** Whether `latest` names a release newer than the one `current` names. */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

/**
 * Repairs the payload of a "latest release" answer into an update.
 *
 * The payload is untrusted: it comes from a network the app does not
 * control, and a release whose tag cannot be read or whose link is not
 * `https` is a release the app will not point its user at.
 */
export function normalizeAvailableUpdate(value: unknown): AvailableUpdate | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tag = typeof record.tag_name === 'string' ? record.tag_name : null;
  const url = typeof record.html_url === 'string' ? record.html_url : null;

  if (tag === null || url === null || !url.startsWith('https://')) {
    return null;
  }

  const parts = parseVersion(tag);
  if (parts === null) {
    return null;
  }

  return { version: parts.join('.'), url };
}

/**
 * The update to announce, or nothing.
 *
 * `null` is the honest answer for "no release", "a release we cannot
 * read", and "a release we already have" alike: the banner asks one
 * question and needs one shape of answer.
 */
export function availableUpdate(
  release: AvailableUpdate | null,
  currentVersion: string,
): AvailableUpdate | null {
  if (release === null) {
    return null;
  }

  return isNewerVersion(release.version, currentVersion) ? release : null;
}
