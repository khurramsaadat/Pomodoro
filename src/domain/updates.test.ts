import { describe, expect, it } from 'vitest';

import {
  availableUpdate,
  compareVersions,
  isNewerVersion,
  normalizeAvailableUpdate,
  parseVersion,
} from './updates';

describe('parsing a version', () => {
  it('reads a dotted run of numbers, with or without a leading v', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('0.2')).toEqual([0, 2]);
    expect(parseVersion(' 2.0.1 ')).toEqual([2, 0, 1]);
  });

  it('ignores anything after the numbers, so a pre-release is not a version', () => {
    expect(parseVersion('v0.2.0-beta.1')).toEqual([0, 2, 0]);
  });

  it('refuses a value that is not a version at all', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('nightly')).toBeNull();
    expect(parseVersion('v-next')).toBeNull();
  });
});

describe('comparing versions', () => {
  it('compares numerically rather than as text', () => {
    // 1.10.0 is newer than 1.9.9, which a string comparison gets wrong.
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
  });

  it('treats a missing part as zero', () => {
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(isNewerVersion('2.0.1', '2.0')).toBe(true);
  });

  it('knows the same version from a newer one and an older one', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(false);
    expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true);
  });
});

describe('reading a release payload', () => {
  it('takes the version out of the tag and keeps the link', () => {
    const release = normalizeAvailableUpdate({
      tag_name: 'v0.2.0',
      html_url: 'https://github.com/khurramsaadat/Pomodoro/releases/tag/v0.2.0',
      name: '0.2.0',
    });

    expect(release).toEqual({
      version: '0.2.0',
      url: 'https://github.com/khurramsaadat/Pomodoro/releases/tag/v0.2.0',
    });
  });

  it('refuses a payload that is not an object', () => {
    expect(normalizeAvailableUpdate(null)).toBeNull();
    expect(normalizeAvailableUpdate('v0.2.0')).toBeNull();
  });

  it('refuses a payload with no readable tag', () => {
    expect(normalizeAvailableUpdate({ html_url: 'https://example.com' })).toBeNull();
    expect(normalizeAvailableUpdate({ tag_name: 'latest', html_url: 'https://example.com' })).toBeNull();
  });

  it('refuses a link that is not https', () => {
    expect(normalizeAvailableUpdate({ tag_name: 'v0.2.0', html_url: 'http://example.com' })).toBeNull();
  });
});

describe('deciding whether to announce a release', () => {
  const release = {
    version: '0.2.0',
    url: 'https://github.com/khurramsaadat/Pomodoro/releases/tag/v0.2.0',
  };

  it('announces a newer release', () => {
    expect(availableUpdate(release, '0.1.0')).toEqual(release);
  });

  it('says nothing about the version already running', () => {
    expect(availableUpdate(release, '0.2.0')).toBeNull();
  });

  it('says nothing about a release that has already been superseded locally', () => {
    expect(availableUpdate(release, '1.0.0')).toBeNull();
  });

  it('says nothing when there is no release to read', () => {
    expect(availableUpdate(null, '0.1.0')).toBeNull();
  });
});
