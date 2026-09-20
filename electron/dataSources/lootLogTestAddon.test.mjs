import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A "Guild Tools (Test)" build works with the TEST addon (GuildToolsLootTest); a normal build with the
// real one. Each must read only its own saved data, so a test session can never leak into (or be fed
// by) the real addon's data.
let tempDir;
let wowPath;
let lootLog;

const svDir = () => path.join(wowPath, 'WTF', 'Account', '88#1', 'SavedVariables');
// Same shape WoW writes to SavedVariables: every field followed by a comma, including the last.
const record = (winner) => `{
["itemId"] = 25,
["itemLink"] = "[Worn Shortsword]",
["winner"] = "${winner}",
["boss"] = "Some Boss",
["slot"] = "One-Hand",
["time"] = 1800000000,
["difficulty"] = "Mythic",
["zone"] = "Some Dungeon",
["contentType"] = "party",
},`;

function writeSv(fileName, varName, winner, character) {
  mkdirSync(svDir(), { recursive: true });
  // Laid out the way WoW writes SavedVariables: multi-line tables, a trailing comma after every field.
  const source = [
    `${varName} = {`,
    '["character"] = {',
    `["name"] = "${character}",`,
    '["realm"] = "Argent Dawn",',
    '["at"] = 1,',
    '},',
    '["records"] = {',
    record(winner),
    '},',
    '["trades"] = {},',
    '["needLosses"] = {},',
    '}',
    '',
  ].join(String.fromCharCode(10));
  writeFileSync(path.join(svDir(), fileName), source);
}

function writeToc(dir, name, version) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${name}.toc`), `## Interface: 120100\n## Title: ${name}\n## Version: ${version}\n## SavedVariables: ${name}DB\n\n${name}.lua\n`);
}

async function load(testMode) {
  if (testMode) process.env.GUILD_TOOLS_TEST_MODE = '1';
  else delete process.env.GUILD_TOOLS_TEST_MODE;
  vi.resetModules();
  lootLog = await import('./lootLog.cjs');
  lootLog.setWowPath(wowPath);
}

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-testaddon-'));
  wowPath = path.join(tempDir, 'wow');
  mkdirSync(path.join(wowPath, 'WTF', 'Account'), { recursive: true });
  process.env.DATA_DIR = tempDir;
  writeSv('GuildToolsLoot.lua', 'GuildToolsLootDB', 'RealWinner', 'RealChar');
  writeSv('GuildToolsLootTest.lua', 'GuildToolsLootTestDB', 'TestWinner', 'TestChar');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  delete process.env.GUILD_TOOLS_TEST_MODE;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('a normal build reads the real addon only', () => {
  it('records and character come from GuildToolsLoot', async () => {
    await load(false);
    expect(lootLog.getLootRecords().records.map((r) => r.winner)).toEqual(['RealWinner']);
    expect(lootLog.getCharacterName()).toBe('RealChar');
  });
});

describe('a test build reads the test addon only', () => {
  it('records (with their zone and content type) and character come from GuildToolsLootTest', async () => {
    await load(true);
    const { records, status } = lootLog.getLootRecords();
    expect(status).toBe('ok');
    expect(records.map((r) => r.winner)).toEqual(['TestWinner']);
    expect(records[0]).toMatchObject({ zone: 'Some Dungeon', contentType: 'party', difficulty: 'Mythic' });
    expect(lootLog.getCharacterName()).toBe('TestChar');
  });

  it('reports the addon as not installed when only the REAL addon has data (it never falls back to it)', async () => {
    rmSync(path.join(svDir(), 'GuildToolsLootTest.lua'));
    await load(true);
    expect(lootLog.getLootRecords()).toMatchObject({ records: [], status: 'addon_not_installed' });
  });

  it('compares versions against the TEST addon copy in WoW, not the real addon', async () => {
    writeToc(path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLoot'), 'GuildToolsLoot', '9.9');
    writeToc(path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLootTest'), 'GuildToolsLootTest', '1.6-test');
    writeToc(path.join(tempDir, 'bundled'), 'GuildToolsLootTest', '1.6-test');
    await load(true);
    expect(lootLog.getAddonVersionInfo(path.join(tempDir, 'bundled', 'GuildToolsLootTest.toc'))).toMatchObject({ installed: '1.6-test', status: 'current' });
  });
});

describe('installing the addon', () => {
  it('a normal build installs GuildToolsLoot and never touches a test addon', async () => {
    await load(false);
    const dest = lootLog.installAddon();
    expect(path.basename(dest)).toBe('GuildToolsLoot');
    expect(existsSync(path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLoot', 'GuildToolsLoot.lua'))).toBe(true);
    expect(existsSync(path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLootTest'))).toBe(false);
  });

  it('a test build installs the generated test addon (needs npm run addon:test first) and never overwrites the real one', async () => {
    const realDir = path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLoot');
    mkdirSync(realDir, { recursive: true });
    writeFileSync(path.join(realDir, 'GuildToolsLoot.lua'), '-- real addon, must stay untouched');
    await load(true);
    const dest = lootLog.installAddon();
    expect(path.basename(dest)).toBe('GuildToolsLootTest');
    const installed = readFileSync(path.join(dest, 'GuildToolsLootTest.lua'), 'utf8');
    expect(installed).toContain('SLASH_GUILDTOOLSLOOTTEST1 = "/gtloottest"');
    expect(readFileSync(path.join(realDir, 'GuildToolsLoot.lua'), 'utf8')).toBe('-- real addon, must stay untouched');
  });
});
