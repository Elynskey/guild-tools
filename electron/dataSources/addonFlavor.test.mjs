import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A fake WoW folder with BOTH addons installed and different saved wins, so which addon a read means is visible.
let wow;
let dataDir;

const lua = (varName, winner) => `${varName} = {\n  ["records"] = {\n    { ["itemId"] = 25, ["itemLink"] = "[Worn Shortsword]", ["winner"] = "${winner}", ["time"] = 1800000000 },\n  },\n  ["trades"] = {},\n  ["needLosses"] = {},\n}\n`;

beforeEach(async () => {
  wow = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-wow-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-data-'));
  const sv = path.join(wow, 'WTF', 'Account', 'ACCT', 'SavedVariables');
  fs.mkdirSync(sv, { recursive: true });
  fs.writeFileSync(path.join(sv, 'GuildToolsLoot.lua'), lua('GuildToolsLootDB', 'RealWinner'));
  fs.writeFileSync(path.join(sv, 'GuildToolsLootTest.lua'), lua('GuildToolsLootTestDB', 'TestWinner'));
  for (const [name, version] of [['GuildToolsLoot', '0.0.1'], ['GuildToolsLootTest', '9.9.9']]) {
    const dir = path.join(wow, 'Interface', 'AddOns', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.toc`), `## Title: ${name}\n## Version: ${version}\n${name}.lua\n`);
  }
  fs.writeFileSync(path.join(dataDir, 'wow-path.json'), JSON.stringify({ wowPath: wow }));
  process.env.DATA_DIR = dataDir;
  process.env.GUILD_TOOLS_TEST_MODE = '1'; // this is a Test build
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(wow, { recursive: true, force: true });
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.GUILD_TOOLS_TEST_MODE;
});

describe('withAddonFlavor: the Monitor can read the real addon from a test build', () => {
  it('a test build reads the TEST addon by default and the REAL one inside withAddonFlavor("real")', async () => {
    const lootLog = await import('./lootLog.cjs');
    expect(lootLog.getLootRecords().records[0].winner).toBe('TestWinner');
    expect(lootLog.withAddonFlavor('real', () => lootLog.getLootRecords()).records[0].winner).toBe('RealWinner');
    expect(lootLog.getLootRecords().records[0].winner).toBe('TestWinner');
  });

  it('the installed addon version follows the flavor too', async () => {
    const lootLog = await import('./lootLog.cjs');
    expect(lootLog.getAddonVersionInfo().installed).toBe('9.9.9');
    expect(lootLog.withAddonFlavor('real', () => lootLog.getAddonVersionInfo()).installed).toBe('0.0.1');
  });

  it('always puts the flavor back, even when the callback throws', async () => {
    const lootLog = await import('./lootLog.cjs');
    expect(() =>
      lootLog.withAddonFlavor('real', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(lootLog.getLootRecords().records[0].winner).toBe('TestWinner');
  });

  it('nests and restores the outer flavor', async () => {
    const lootLog = await import('./lootLog.cjs');
    const inner = lootLog.withAddonFlavor('real', () => {
      const before = lootLog.getLootRecords().records[0].winner;
      const nested = lootLog.withAddonFlavor('test', () => lootLog.getLootRecords().records[0].winner);
      return [before, nested, lootLog.getLootRecords().records[0].winner];
    });
    expect(inner).toEqual(['RealWinner', 'TestWinner', 'RealWinner']);
  });

  it('is read-only: reading the real addon never changes either saved-variables file', async () => {
    const lootLog = await import('./lootLog.cjs');
    const sv = path.join(wow, 'WTF', 'Account', 'ACCT', 'SavedVariables');
    const before = ['GuildToolsLoot.lua', 'GuildToolsLootTest.lua'].map((f) => fs.readFileSync(path.join(sv, f), 'utf8'));
    lootLog.withAddonFlavor('real', () => [lootLog.getLootRecords(), lootLog.getAddonVersionInfo(), lootLog.getWowPathConfig()]);
    expect(['GuildToolsLoot.lua', 'GuildToolsLootTest.lua'].map((f) => fs.readFileSync(path.join(sv, f), 'utf8'))).toEqual(before);
  });
});
