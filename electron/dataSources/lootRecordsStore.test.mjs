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

describe('sync duplicate detection (two capture paths/clients observing the same real win)', () => {
  it('dedupes two addon-captured records for the same item+winner landing a second apart (confirmed live 2026-09-06)', () => {
    const first = store.sync([{ itemId: 268232, itemLink: '|cnIQ4:|Hitem:268232::::::::90:254::5:5:...|h[Cincture of the Abyssal Grotto]|h|r', winner: 'Dharma', boss: 'Nymrissa Wavecaller', time: 1788656362 }], [], []);
    expect(first.addedRecords).toHaveLength(1);
    const second = store.sync([{ itemId: 268232, itemLink: '|cnIQ4:|Hitem:268232::::::::90:577::5:5:...|h[Cincture of the Abyssal Grotto]|h|r', winner: 'Dharma', boss: 'Nymrissa Wavecaller', time: 1788656363 }], [], []);
    expect(second.addedRecords).toHaveLength(0);
    expect(second.records).toHaveLength(1);
  });

  it('does not dedupe two addon-captured records for the same item+winner more than a minute apart (a real second win)', () => {
    store.sync([{ itemId: 268240, itemLink: '[Restless Spirit Shackles]', winner: 'Ranikina', time: 1000 }], [], []);
    const second = store.sync([{ itemId: 268240, itemLink: '[Restless Spirit Shackles]', winner: 'Ranikina', time: 1000 + 3600 }], [], []);
    expect(second.addedRecords).toHaveLength(1);
    expect(second.records).toHaveLength(2);
  });

  it('does not dedupe a different winner or a different item within the same second', () => {
    store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Dharma', time: 1000 }], [], []);
    const differentWinner = store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Eilerra', time: 1000 }], [], []);
    expect(differentWinner.addedRecords).toHaveLength(1);
    const differentItem = store.sync([{ itemId: 2, itemLink: '[Item B]', winner: 'Dharma', time: 1000 }], [], []);
    expect(differentItem.addedRecords).toHaveLength(1);
  });

  it('dedupes an addon-captured record against an earlier manual placeholder for the same win, using the wider window (confirmed live: Perseffonee, 55 seconds apart)', () => {
    store.manualAdd({ winner: 'Perseffonee', itemName: 'Bubblefin Splash Guard', time: 1788570613 });
    const synced = store.sync([{ itemId: 268262, itemLink: '|cnIQ4:|Hitem:268262::::::::90:254::3:3:...|h[Bubblefin Splash Guard]|h|r', winner: 'Perseffonee', time: 1788570668 }], [], []);
    expect(synced.addedRecords).toHaveLength(0);
    expect(synced.records).toHaveLength(1);
  });
});

describe('chat-tail reconciliation', () => {
  it('upgrades a chat-tail placeholder in place when the addon syncs the same win hours later', () => {
    const first = store.sync([{ itemId: 268232, itemLink: '[Cincture of the Abyssal Grotto]', winner: 'Dharma', boss: null, slot: null, source: 'chat-tail', time: 1000 }], [], []);
    expect(first.addedRecords).toHaveLength(1);
    const placeholderId = first.records[0].id;

    const THREE_HOURS = 3 * 60 * 60;
    const second = store.sync([{ itemId: 268232, itemLink: '|cnIQ4:|Hitem:268232::::::::90:577::5:5:...|h[Cincture of the Abyssal Grotto]|h|r', winner: 'Dharma', boss: 'Nymrissa Wavecaller', slot: 'Waist', time: 1000 + THREE_HOURS }], [], []);

    expect(second.records).toHaveLength(1);
    expect(second.addedRecords).toHaveLength(0); // an upgrade is not a new win -- must not be re-announced
    const upgraded = second.records[0];
    expect(upgraded.id).toBe(placeholderId);
    expect(upgraded.boss).toBe('Nymrissa Wavecaller');
    expect(upgraded.slot).toBe('Waist');
    expect(upgraded.source).toBeUndefined();
    expect(upgraded.time).toBe(1000); // keeps the earlier, near-real-time chat-tail stamp
  });

  it('still dedupes two chat-tail records for the same winner+item a couple seconds apart (tight window unchanged)', () => {
    store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Dharma', boss: null, slot: null, source: 'chat-tail', time: 1000 }], [], []);
    const second = store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Dharma', boss: null, slot: null, source: 'chat-tail', time: 1002 }], [], []);
    expect(second.records).toHaveLength(1);
    expect(second.addedRecords).toHaveLength(0);
  });

  it('leaves a normal addon-only sync (no chat-tail involved anywhere) byte-for-byte unaffected', () => {
    const first = store.sync([{ itemId: 5, itemLink: '[Item B]', winner: 'Eilerra', boss: 'Some Boss', slot: 'Chest', time: 1000 }], [], []);
    const second = store.sync([{ itemId: 5, itemLink: '[Item B]', winner: 'Eilerra', boss: 'Some Boss', slot: 'Chest', time: 1001 }], [], []);
    expect(second.records).toHaveLength(1);
    expect(second.records[0].boss).toBe('Some Boss');
    expect(first.records[0].id).toBe(second.records[0].id);
  });

  it('inserts a new record instead of upgrading when winner/item genuinely differ from any existing chat-tail placeholder', () => {
    store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Dharma', boss: null, slot: null, source: 'chat-tail', time: 1000 }], [], []);
    const second = store.sync([{ itemId: 2, itemLink: '[Item C]', winner: 'Eilerra', boss: 'Some Boss', slot: 'Feet', time: 1000 }], [], []);
    expect(second.records).toHaveLength(2);
    expect(second.addedRecords).toHaveLength(1);
  });

  it('manualAdd still guards against a chat-tail-sourced existing record, same as any other', () => {
    store.sync([{ itemId: 1, itemLink: '[Item A]', winner: 'Dharma', boss: null, slot: null, source: 'chat-tail', time: 1000 }], [], []);
    expect(() => store.manualAdd({ winner: 'Dharma', itemName: 'Item A', time: 1000 })).toThrow(/already has a logged win/);
  });
});

describe('update duplicate detection (editing must guard the same as adding)', () => {
  it('rejects editing a record into a collision with a DIFFERENT existing record', () => {
    store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Something Else', time: 1000 });
    const toEdit = records.find((r) => r.itemLink.includes('Something Else'));
    expect(() => store.update(toEdit.id, { itemName: 'Shellbound Bracers' })).toThrow(/already has a separate logged win/);
  });

  it('does not treat a record as colliding with itself (editing something else about it is fine)', () => {
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', boss: 'The Lost Explorers', time: 1000 });
    const record = records[0];
    const updated = store.update(record.id, { boss: 'A Different Boss' });
    expect(updated.find((r) => r.id === record.id).boss).toBe('A Different Boss');
  });

  it('allows editing the winner to a name that has no conflicting record', () => {
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const record = records[0];
    const updated = store.update(record.id, { winner: 'Someone New' });
    expect(updated.find((r) => r.id === record.id).winner).toBe('Someone New');
  });

  it('checks the collision using the PATCHED values, not the record\'s original ones', () => {
    store.manualAdd({ winner: 'Abractus', itemName: 'First Mate\'s Shellward', time: 1000 });
    const records = store.manualAdd({ winner: 'Silverhorn', itemName: 'Shellbound Bracers', time: 1000 });
    const toEdit = records.find((r) => r.winner === 'Silverhorn');
    // Editing BOTH winner and item to match the Abractus record should still be caught.
    expect(() => store.update(toEdit.id, { winner: 'Abractus', itemName: 'First Mate\'s Shellward' })).toThrow(/already has a separate logged win/);
  });
});
