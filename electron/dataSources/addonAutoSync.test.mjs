import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// The background addon sync must never reach a real proxy from a test: proxyClient is replaced in Node's own require
// cache with a fake BEFORE fetchLootLog.cjs is first loaded.
const require = createRequire(import.meta.url);

let wow;
let dataDir;
let svFile;
let calls;
let fetchLog;
let proxyAvailable;

const record = (winner, time) => `    { ["itemId"] = 25, ["itemLink"] = "[Worn Shortsword]", ["winner"] = "${winner}", ["time"] = ${time} },\n`;
const writeSaved = (winners) => fs.writeFileSync(svFile, `GuildToolsLootDB = {\n  ["records"] = {\n${winners.map((w, i) => record(w, 1800000000 + i)).join('')}  },\n  ["trades"] = {},\n  ["needLosses"] = {},\n}\n`);
const bump = (ms) => {
  const t = new Date(Date.now() + ms);
  fs.utimesSync(svFile, t, t);
};

beforeEach(() => {
  wow = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-wow-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-data-'));
  const sv = path.join(wow, 'WTF', 'Account', 'ACCT', 'SavedVariables');
  fs.mkdirSync(sv, { recursive: true });
  svFile = path.join(sv, 'GuildToolsLoot.lua');
  fs.writeFileSync(path.join(dataDir, 'wow-path.json'), JSON.stringify({ wowPath: wow }));
  process.env.DATA_DIR = dataDir;
  delete process.env.GUILD_TOOLS_TEST_MODE;

  calls = [];
  proxyAvailable = true;
  const fake = {
    isAvailable: () => proxyAvailable,
    syncLootRecords: async (records, trades, needLosses) => {
      calls.push({ records: records.length, trades: trades.length, needLosses: needLosses.length });
    },
    getSharedLootRecords: async () => ({ records: [], trades: [] }),
  };
  const proxyPath = require.resolve('./proxyClient.cjs');
  require.cache[proxyPath] = { id: proxyPath, filename: proxyPath, loaded: true, exports: fake, children: [], paths: [] };
  for (const f of ['fetchLootLog.cjs', 'lootLog.cjs']) delete require.cache[require.resolve(`./${f}`)];
  vi.resetModules();
  fetchLog = require('./fetchLootLog.cjs');
});

afterEach(() => {
  delete require.cache[require.resolve('./proxyClient.cjs')];
  fs.rmSync(wow, { recursive: true, force: true });
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

describe('syncAddonDataIfChanged: a /reload reaches the store without opening Loot History', () => {
  it('does nothing when there is no saved-variables file yet', async () => {
    expect(await fetchLog.syncAddonDataIfChanged()).toEqual({ synced: false });
    expect(calls).toHaveLength(0);
  });

  it('pushes the addon data the first time it sees the file, then stays quiet until the file changes', async () => {
    writeSaved(['Thundoor', 'Devkra']);
    const first = await fetchLog.syncAddonDataIfChanged();
    expect(first).toEqual({ synced: true, records: 2 });
    expect(calls).toEqual([{ records: 2, trades: 0, needLosses: 0 }]);

    expect(await fetchLog.syncAddonDataIfChanged()).toEqual({ synced: false });
    expect(await fetchLog.syncAddonDataIfChanged()).toEqual({ synced: false });
    expect(calls).toHaveLength(1);
  });

  it('a /reload (the file is rewritten) is picked up on the next call', async () => {
    writeSaved(['Thundoor']);
    await fetchLog.syncAddonDataIfChanged();
    writeSaved(['Thundoor', 'Devkra', 'Odasa']);
    bump(5000);
    const again = await fetchLog.syncAddonDataIfChanged();
    expect(again).toEqual({ synced: true, records: 3 });
    expect(calls.at(-1)).toEqual({ records: 3, trades: 0, needLosses: 0 });
  });

  it('a failed push is retried on the next call instead of being remembered as done', async () => {
    writeSaved(['Thundoor']);
    const proxy = require('./proxyClient.cjs');
    const ok = proxy.syncLootRecords;
    proxy.syncLootRecords = async () => {
      throw new Error('proxy down');
    };
    await expect(fetchLog.syncAddonDataIfChanged()).rejects.toThrow('proxy down');
    proxy.syncLootRecords = ok;
    expect(await fetchLog.syncAddonDataIfChanged()).toEqual({ synced: true, records: 1 });
  });

  it('without a proxy it reconciles into the local store instead', async () => {
    proxyAvailable = false;
    writeSaved(['Thundoor']);
    expect(await fetchLog.syncAddonDataIfChanged()).toEqual({ synced: true, records: 1 });
    expect(calls).toHaveLength(0);
    const local = JSON.parse(fs.readFileSync(path.join(dataDir, 'loot-records.json'), 'utf8'));
    expect(local.records.map((r) => r.winner)).toEqual(['Thundoor']);
  });

  it('an empty addon file is not "synced" (nothing to offer)', async () => {
    writeSaved([]);
    const r = await fetchLog.syncAddonDataIfChanged();
    expect(r.synced).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
