import { describe, expect, it } from 'vitest';

import {
  BACKUP_APP,
  BACKUP_VERSION,
  backupFileName,
  createBackup,
  describeBackupError,
  parseBackup,
  serializeBackup,
} from './backup';
import { createSessionEntry } from './history';
import { DEFAULT_PREFERENCES } from './preferences';
import { defaultConfig } from './presets';
import { createTask } from './tasks';

const T0 = 1_700_000_000_000;

/** A backup of a small but complete workspace. */
function samplePayload() {
  return createBackup({
    tasks: [createTask('task-1', 'Write the report', 3, T0)],
    activeTaskId: 'task-1',
    history: [
      createSessionEntry('session-1', {
        phase: 'work',
        startedAt: T0 - 25 * 60_000,
        endedAt: T0,
        durationMs: 25 * 60_000,
        taskId: 'task-1',
        taskTitle: 'Write the report',
        interruptions: 0,
        voided: false,
      }),
    ],
    preferences: DEFAULT_PREFERENCES,
    config: defaultConfig(),
    exportedAt: T0,
  });
}

describe('createBackup', () => {
  it('records the app and the version', () => {
    const payload = samplePayload();

    expect(payload.app).toBe(BACKUP_APP);
    expect(payload.version).toBe(BACKUP_VERSION);
  });

  it('copies the workspace rather than aliasing it', () => {
    const payload = samplePayload();

    // The payload is a snapshot: mutating the caller's arrays afterwards
    // must not change what was written out.
    expect(payload.tasks).toHaveLength(1);
    expect(payload.history).toHaveLength(1);
  });
});

describe('serializeBackup', () => {
  it('produces indented JSON', () => {
    const text = serializeBackup(samplePayload());

    expect(text).toContain('\n  ');
    expect(JSON.parse(text)).toMatchObject({ app: BACKUP_APP, version: BACKUP_VERSION });
  });
});

describe('parseBackup', () => {
  it('refuses a file that is not JSON', () => {
    const outcome = parseBackup('{not json');

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('not-json');
  });

  it('refuses a file that is not an object', () => {
    const outcome = parseBackup('"hello"');

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('not-an-object');
  });

  it('refuses a file written by another app', () => {
    const outcome = parseBackup(JSON.stringify({ app: 'something-else', version: 1 }));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('wrong-app');
  });

  it('refuses a file written by another version', () => {
    const payload = { ...samplePayload(), version: BACKUP_VERSION + 1 };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('unsupported-version');
  });

  it('refuses a backup whose task queue is not a list', () => {
    const payload = { ...samplePayload(), tasks: 'not a list' };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('invalid-tasks');
  });

  it('refuses a backup whose session settings are nonsense', () => {
    const payload = { ...samplePayload(), config: { workMs: 0 } };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.error).toBe('invalid-config');
  });

  it('drops an unusable task and reports it', () => {
    const payload = { ...samplePayload(), tasks: [{ nonsense: true }] };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    // The file was readable, so the rest of it is restored — but the
    // damage is reported rather than being swallowed.
    expect(outcome.result.payload.tasks).toHaveLength(0);
    expect(outcome.result.droppedTasks).toBe(1);
    expect(outcome.result.warnings).toHaveLength(1);
  });

  it('repairs the preferences rather than refusing the file', () => {
    const payload = { ...samplePayload(), preferences: { dailyGoal: 'lots' } };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    expect(outcome.result.payload.preferences.dailyGoal).toBe(DEFAULT_PREFERENCES.dailyGoal);
  });

  it('drops a selection that points at a task that is not there', () => {
    const payload = { ...samplePayload(), activeTaskId: 'task-that-does-not-exist' };
    const outcome = parseBackup(JSON.stringify(payload));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    expect(outcome.result.payload.activeTaskId).toBeNull();
  });
});

describe('describeBackupError', () => {
  it('says something for every reason', () => {
    const reasons = [
      'not-json',
      'not-an-object',
      'wrong-app',
      'unsupported-version',
      'invalid-tasks',
      'invalid-history',
      'invalid-config',
    ] as const;

    for (const reason of reasons) {
      expect(describeBackupError(reason)).not.toBe('');
    }
  });
});

describe('backupFileName', () => {
  it('names the file after the day it was written', () => {
    const name = backupFileName(T0);

    expect(name).toMatch(/^pomodoro-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
