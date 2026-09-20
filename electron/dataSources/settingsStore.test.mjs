import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
let store;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-settings-'));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  store = await import('./settingsStore.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('auto-post default', () => {
  it('is on when nothing has been saved', () => {
    expect(store.load().autoPostLoot).toBe(true);
  });

  it('stays on when other settings are saved without mentioning it', () => {
    store.save({ minDps: 90000 });
    expect(store.load().autoPostLoot).toBe(true);
  });

  it('keeps an explicit off, including through later partial saves', () => {
    store.save({ autoPostLoot: false });
    store.save({ minDps: 90000 });
    expect(store.load().autoPostLoot).toBe(false);
  });

  it('an officer can switch it back on', () => {
    store.save({ autoPostLoot: false });
    store.save({ autoPostLoot: true });
    expect(store.load().autoPostLoot).toBe(true);
  });
});
