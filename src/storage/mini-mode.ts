import { normalizeMiniPosition, type MiniPosition } from '@/domain/mini-mode';
import { createRepository, isRecord, type Repository } from './repository';

/**
 * Persistence of the mini timer's visibility and position.
 *
 * The position is validated rather than trusted: a payload that names an
 * unknown corner or carries a non-numeric offset is repaired, because a
 * corrupt position would otherwise strand the widget off screen where the
 * user could not drag it back.
 */

export const MINI_MODE_STORAGE_KEY = 'pomodoro-mini-mode';

export interface MiniModeState {
  /** Whether the mini timer is shown. */
  readonly enabled: boolean;
  /** Where the mini timer is anchored. */
  readonly position: MiniPosition;
}

export const miniModeRepository: Repository<MiniModeState> = createRepository<MiniModeState>({
  key: MINI_MODE_STORAGE_KEY,
  validate: (value) => {
    if (!isRecord(value)) {
      return null;
    }

    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
      position: normalizeMiniPosition(value.position),
    };
  },
});
