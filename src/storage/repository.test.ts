import { beforeEach, describe, expect, it } from 'vitest';

import { createRepository, STORAGE_SCHEMA_VERSION } from '@/storage/repository';

const KEY = 'test-repository';

function makeRepository<T>(validate: (value: unknown) => T | null) {
  return createRepository<T>({ key: KEY, validate });
}

describe('createRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing has been stored', () => {
    expect(makeRepository<string>(() => 'ok').read()).toBeNull();
  });

  it('writes and reads back a value', () => {
    const repository = makeRepository<string>((value) =>
      typeof value === 'string' ? value : null,
    );

    repository.write('hello');

    expect(repository.read()).toBe('hello');
  });

  it('stamps the payload with the schema version', () => {
    const repository = makeRepository<string>((value) =>
      typeof value === 'string' ? value : null,
    );

    repository.write('hello');

    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}').version).toBe(STORAGE_SCHEMA_VERSION);
  });

  it('rejects a value that fails validation', () => {
    const repository = makeRepository<string>(() => null);

    repository.write('hello');

    expect(repository.read()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{not json');

    expect(makeRepository<string>(() => 'ok').read()).toBeNull();
  });

  it('returns null for a payload with no version', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ data: 'hello' }));

    expect(makeRepository<string>(() => 'ok').read()).toBeNull();
  });

  it('discards a payload written by an older schema version', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 0, data: 'hello' }));

    expect(makeRepository<string>(() => 'ok').read()).toBeNull();
  });

  it('migrates a payload written by an older schema version', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 0, data: 'hello' }));

    const repository = createRepository<string>({
      key: KEY,
      validate: () => null,
      migrate: (value, version) => (version === 0 && value === 'hello' ? 'migrated' : null),
    });

    expect(repository.read()).toBe('migrated');
  });

  it('clears the stored value', () => {
    const repository = makeRepository<string>(() => 'ok');
    repository.write('hello');
    repository.clear();

    expect(repository.read()).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const repository = makeRepository<string>(() => 'ok');

    expect(repository.read()).toBeNull();
    expect(() => repository.write('hello')).not.toThrow();
    expect(() => repository.clear()).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
    removeItem.mockRestore();
  });
});
