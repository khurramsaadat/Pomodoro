/**
 * Time formatting helpers.
 *
 * These are pure functions so they can be unit-tested without a DOM and
 * reused by both the web and desktop tiers.
 */

/**
 * Formats a duration in milliseconds as `MM:SS`, or `H:MM:SS` when the
 * duration is an hour or longer.
 *
 * Negative values are clamped to zero, and the result is always
 * zero-padded so the countdown does not jitter as digits change.
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number): string => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats a duration for a tooltip or tray label, e.g. `24 min 31 s`.
 */
export function formatDurationLong(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);

  return parts.join(' ');
}

/** Converts a duration in minutes to milliseconds. */
export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60_000);
}

/** Converts a duration in milliseconds to minutes, rounded to the nearest integer. */
export function msToMinutes(milliseconds: number): number {
  return Math.round(milliseconds / 60_000);
}

/**
 * The local calendar day of a timestamp, as `YYYY-MM-DD`.
 *
 * Local rather than UTC because a day boundary should follow the user's
 * own clock, not Greenwich.
 */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Midnight at the start of the local day containing `timestamp`. */
export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * The local calendar day a given number of days away from `timestamp`.
 *
 * The step is a *calendar* step rather than a fixed number of milliseconds,
 * because a day is not always 86 400 000 ms long: across a daylight-saving
 * boundary it is 23 or 25 hours. Subtracting a fixed 86 400 000 therefore
 * lands on the wrong day — sometimes twice on the same day, and sometimes
 * skipping one entirely.
 *
 * The date is normalised to local midnight first, so the result does not
 * depend on the time of day, and `setDate` moves the day of the month the
 * way a calendar does.
 */
export function shiftLocalDay(timestamp: number, offset: number): number {
  const date = new Date(startOfLocalDay(timestamp));
  date.setDate(date.getDate() - offset);
  return date.getTime();
}

/** Whether two timestamps fall on the same local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
  return localDayKey(a) === localDayKey(b);
}
