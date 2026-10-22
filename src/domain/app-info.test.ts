import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_IDENTIFIER, APP_NAME, APP_VERSION } from './app-info';

/** Reads a JSON file from the project root. */
function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as Record<string, unknown>;
}

describe('the app metadata', () => {
  it('agrees with the package the frontend is built from', () => {
    expect(readJson('package.json').version).toBe(APP_VERSION);
  });

  it('agrees with the desktop bundle', () => {
    // Three copies of a version is two more than can be kept in step by
    // hand, which is why the copies are checked rather than trusted.
    const tauri = readJson('src-tauri/tauri.conf.json');

    expect(tauri.version).toBe(APP_VERSION);
    expect(tauri.identifier).toBe(APP_IDENTIFIER);
    expect(tauri.productName).toBe(APP_NAME);
  });
});
