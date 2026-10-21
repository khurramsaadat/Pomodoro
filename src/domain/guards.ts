/**
 * Small type guards shared by the domain modules.
 *
 * The domain validates untrusted data all the time — a persisted payload, an
 * imported backup — and every one of those checks begins with the same
 * question: is this a plain object, and is this number usable? The answers
 * live here so that the check is written once and behaves the same everywhere.
 */

/** Whether a value is a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Whether a value is a real, finite number. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Whether a value is a finite number that is not negative. */
export function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/** Whether a value is a whole number that is not negative. */
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
