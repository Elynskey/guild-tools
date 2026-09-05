import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// resolveDataDir() (dataDir.cjs) falls back to process.env.DATA_DIR outside Electron --
// a fresh temp dir per test gives real file-based isolation without mocking fs.
let tempDir;
let store;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-loot-store-'));
  process.env.DATA_DIR = tempDir;
  // Re-imported fresh each test since the module has no in-memory state of its own --
  // every call re-reads the JSON file from resolveDataDir() -- but Vitest's module
  // registry would otherwise cache dataDir.cjs's resolved value across tests, reusing
  // the first temp dir forever. resetModules() forces a real re-evaluation.
  vi.resetModules();
  store = await import('./lootRecordsStore.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('manualAdd duplicate detection', () => {
  it('rejects a second manual add for the same winner+item within the dedup window', () => {
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', boss: 'The Lost Explorers', slot: 'Wrist', time: 1000 });
    expect(() => store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', boss: 'The Lost Explorers', slot: 'Wrist', time: 1500 })).toThrow(/already has a logged win/);
  });

  it('is case-insensitive on both winner and item name', () => {
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    expect(() => store.manualAdd({ winner: 'SILVERHORN', itemName: 'shellbound bracers', time: 1200 })).toThrow(/already has a logged win/);
  });

  it('allows the same item for a different winner', () => {
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const records = store.manualAdd({ winner: 'Abractus', itemName: 'Shellbound Bracers', time: 1000 });
    expect(records).toHaveLength(2);
  });

  it('allows a different item for the same winner', () => {
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Something Else', time: 1000 });
    expect(records).toHaveLength(2);
  });

  it('allows the same winner+item again once outside the dedup window (a real later win)', () => {
    const SEVEN_HOURS = 7 * 60 * 60;
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 + SEVEN_HOURS });
    expect(records).toHaveLength(2);
  });

  it('also catches a duplicate against an addon-captured record (real hyperlink), not just other manual adds', () => {
    // Simulates what actually happened live: the addon already captured this win with
    // a real |Hitem:...|h[Name]|h|r link before an officer manually re-typed it.
    store.sync([{ itemId: 268239, itemLink: '|cnIQ4:|Hitem:268239::::::::90:577::3:5:43:13696:13662:13333:12834:1:28:7359:::::|h[Shellbound Bracers]|h|r', winner: 'Silverhorn', boss: 'The Lost Explorers', slot: 'Wrist', time: 1000 }], []);
    expect(() => store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1200 })).toThrow(/already has a logged win/);
  });
});
