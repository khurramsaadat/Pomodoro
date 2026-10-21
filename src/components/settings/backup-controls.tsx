import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  backupFileName,
  createBackup,
  describeBackupError,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import { useHistoryStore } from '@/store/history-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { useTaskStore } from '@/store/task-store';
import { useTimerStore } from '@/store/timer-store';

export interface BackupControlsProps {
  /** Additional classes for the container. */
  readonly className?: string;
}

/**
 * The export and import controls.
 *
 * A backup is a *file*, so the file is what the user gets: the browser
 * writes it, and the browser reads it back. The app never sees a path, and
 * the same code works in the web tier and in the desktop window.
 *
 * The import is validated before anything is written. A file that cannot be
 * read is refused outright, and one that can be read but has damage in it
 * is restored as far as it goes — with the damage reported, because a
 * silent partial restore is worse than a refusal.
 */
export function BackupControls({ className }: BackupControlsProps) {
  const tasks = useTaskStore((store) => store.tasks);
  const activeTaskId = useTaskStore((store) => store.activeTaskId);
  const setTasks = useTaskStore((store) => store.setTasks);

  const entries = useHistoryStore((store) => store.entries);
  const setEntries = useHistoryStore((store) => store.setEntries);

  const preferences = usePreferencesStore((store) => store.preferences);
  const setPreferences = usePreferencesStore((store) => store.setPreferences);

  const config = useTimerStore((store) => store.config);
  const setConfig = useTimerStore((store) => store.setConfig);

  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = (): void => {
    const payload = createBackup({
      tasks,
      activeTaskId,
      history: entries,
      preferences,
      config,
      exportedAt: Date.now(),
    });

    const blob = new Blob([serializeBackup(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(Date.now());
    link.click();

    // The object URL is released immediately: the download has already been
    // handed to the browser, and a leaked URL is a leaked blob.
    URL.revokeObjectURL(url);

    toast.success('Backup exported', {
      description: `${tasks.length} task${tasks.length === 1 ? '' : 's'} and ${entries.length} session${entries.length === 1 ? '' : 's'}.`,
    });
  };

  const importBackup = async (file: File): Promise<void> => {
    setBusy(true);

    try {
      const text = await file.text();
      const outcome = parseBackup(text);

      if (!outcome.ok) {
        toast.error('That backup could not be read', {
          description: describeBackupError(outcome.error),
        });
        return;
      }

      const { payload, warnings } = outcome.result;

      setTasks(payload.tasks, payload.activeTaskId ?? null);
      setEntries(payload.history);
      setPreferences(payload.preferences);
      setConfig(payload.config);

      if (warnings.length > 0) {
        toast.warning('The backup was restored, with some damage', {
          description: warnings.join(' '),
        });
        return;
      }

      toast.success('Backup restored', {
        description: `${payload.tasks.length} task${payload.tasks.length === 1 ? '' : 's'} and ${payload.history.length} session${payload.history.length === 1 ? '' : 's'}.`,
      });
    } catch {
      toast.error('That file could not be read');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportBackup}>
          <Download />
          Export backup
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload />
          Import backup
        </Button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Choose a backup file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // The input is cleared so the same file can be chosen twice.
            event.target.value = '';

            if (file) {
              void importBackup(file);
            }
          }}
        />
      </div>
    </div>
  );
}
