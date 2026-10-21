/**
 * The backup: the app's whole state, in one file the user can keep.
 *
 * A backup is only worth having if it can be *restored*, and a backup that
 * can be restored is only trustworthy if it is validated on the way back in.
 * So the schema lives here, in the domain, as pure data: the shape of the
 * file, what counts as a valid one, and how to read one.
 *
 * The file is a plain JSON document with a version. A version is what makes
 * a format a format: a file written by a later build can be recognised and
 * refused rather than half-read, and a file written by an earlier build can
 * be migrated.
 */

import { isRecord } from './guards';
import { validateHistory, type SessionEntry } from './history';
import { normalizePreferences, type Preferences } from './preferences';
import { isValidConfig, normalizeConfig } from './presets';
import { validateTaskList, type Task } from './tasks';
import type { TimerConfig } from './types';

/**
 * The version of the backup format this build writes and reads.
 *
 * It is independent of the storage schema version: a backup is a *file*, and
 * it has to be readable by a build that is not the one that wrote it.
 */
export const BACKUP_VERSION = 1;

/** The name of the app, recorded in the file so its origin is obvious. */
export const BACKUP_APP = 'pomodoro';

/** Everything a backup carries. */
export interface BackupPayload {
  /** The app that wrote the file. */
  readonly app: string;
  /** The format version. */
  readonly version: number;
  /** When the file was written, in epoch ms. */
  readonly exportedAt: number;
  /** The task queue. */
  readonly tasks: readonly Task[];
  /** The id of the task the user was working on, or `null`. */
  readonly activeTaskId: string | null;
  /** The session history, most recent first. */
  readonly history: readonly SessionEntry[];
  /** The user preferences. */
  readonly preferences: Preferences;
  /** The timer configuration. */
  readonly config: TimerConfig;
}

/**
 * The result of reading a backup.
 *
 * The distinction matters: a backup that is *unreadable* is a different
 * thing from one that is *readable but damaged*. The first is refused
 * outright; the second is restored as far as it can be, and the damage is
 * reported so the user knows what did not survive.
 */
export interface BackupResult {
  /** The payload that was read. */
  readonly payload: BackupPayload;
  /** How many tasks were dropped because they were unusable. */
  readonly droppedTasks: number;
  /** How many history entries were dropped because they were unusable. */
  readonly droppedEntries: number;
  /** The problems that were found, described for the user. */
  readonly warnings: readonly string[];
}

/** The reasons a backup could not be read at all. */
export type BackupError =
  | 'not-json'
  | 'not-an-object'
  | 'wrong-app'
  | 'unsupported-version'
  | 'invalid-tasks'
  | 'invalid-history'
  | 'invalid-config';

/** The outcome of an import: either a payload, or the reason it was refused. */
export type BackupOutcome =
  | { readonly ok: true; readonly result: BackupResult }
  | { readonly ok: false; readonly error: BackupError };

/**
 * Builds a backup payload from the app's current state.
 *
 * The caller supplies the pieces rather than this module reaching into the
 * stores, so the domain stays pure and the same function can build a
 * backup of anything.
 */
export function createBackup(input: {
  readonly tasks: readonly Task[];
  readonly activeTaskId: string | null;
  readonly history: readonly SessionEntry[];
  readonly preferences: Preferences;
  readonly config: TimerConfig;
  readonly exportedAt: number;
}): BackupPayload {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt,
    tasks: [...input.tasks],
    activeTaskId: input.activeTaskId,
    history: [...input.history],
    preferences: input.preferences,
    config: input.config,
  };
}

/**
 * Serialises a backup for writing to a file.
 *
 * The JSON is indented, because a backup is something a user may well open
 * and read, and because a file that is meant to be looked at should not look
 * like a machine's output.
 */
export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses a backup file.
 *
 * The text is parsed rather than trusted, and the result is validated
 * against the schema. A file that is not a backup of this app, or that was
 * written by a version this build does not know, is refused rather than
 * half-read: importing a file we do not understand would be worse than
 * refusing it.
 */
export function parseBackup(text: string): BackupOutcome {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'not-an-object' };
  }

  if (parsed.app !== BACKUP_APP) {
    return { ok: false, error: 'wrong-app' };
  }

  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  if (version !== BACKUP_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }

  // The tasks and the history are *lists*: a file whose list is missing or
  // is not a list has been damaged in a way that cannot be repaired, so it
  // is refused. Individual entries inside a list are a different matter —
  // those are dropped and reported.
  if (!Array.isArray(parsed.tasks)) {
    return { ok: false, error: 'invalid-tasks' };
  }
  if (!Array.isArray(parsed.history)) {
    return { ok: false, error: 'invalid-history' };
  }
  if (!isValidConfig(parsed.config as TimerConfig)) {
    return { ok: false, error: 'invalid-config' };
  }

  const tasks = validateTaskList(parsed.tasks);
  if (tasks === null) {
    return { ok: false, error: 'invalid-tasks' };
  }

  const history = validateHistory(parsed.history);
  if (history === null) {
    return { ok: false, error: 'invalid-history' };
  }

  const warnings: string[] = [];

  const droppedTasks = parsed.tasks.length - tasks.length;
  if (droppedTasks > 0) {
    warnings.push(`${droppedTasks} task${droppedTasks === 1 ? '' : 's'} could not be read.`);
  }

  const droppedEntries = parsed.history.length - history.length;
  if (droppedEntries > 0) {
    warnings.push(`${droppedEntries} session${droppedEntries === 1 ? '' : 's'} could not be read.`);
  }

  return {
    ok: true,
    result: {
      payload: {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt:
          typeof parsed.exportedAt === 'number' && Number.isFinite(parsed.exportedAt)
            ? parsed.exportedAt
            : 0,
        tasks,
        // The selection is only kept when it still refers to a task that
        // exists, so an import cannot leave the app pointing at nothing.
        activeTaskId:
          typeof parsed.activeTaskId === 'string' &&
          tasks.some((task) => task.id === parsed.activeTaskId)
            ? parsed.activeTaskId
            : null,
        history,
        // The preferences are repaired rather than refused: one corrupt
        // field must not cost the user the rest of their configuration.
        preferences: normalizePreferences(parsed.preferences),
        config: normalizeConfig(parsed.config),
      },
      droppedTasks,
      droppedEntries,
      warnings,
    },
  };
}

/** A human-readable description of why a backup was refused. */
export function describeBackupError(error: BackupError): string {
  switch (error) {
    case 'not-json':
      return 'That file is not valid JSON.';
    case 'not-an-object':
      return 'That file does not contain a backup.';
    case 'wrong-app':
      return 'That file was not written by this app.';
    case 'unsupported-version':
      return 'That backup was written by a different version of the app.';
    case 'invalid-tasks':
      return 'The task queue in that backup could not be read.';
    case 'invalid-history':
      return 'The session history in that backup could not be read.';
    case 'invalid-config':
      return 'The session settings in that backup could not be read.';
  }
}

/** The name of the file a backup is written to. */
export function backupFileName(now: number): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `pomodoro-backup-${date.getFullYear()}-${month}-${day}.json`;
}
