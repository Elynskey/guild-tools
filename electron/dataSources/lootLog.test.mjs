import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A fake WoW install per test: WTF/Account/<acct>/<Realm>/<Character>/ folders whose
// stamp files carry controlled mtimes, plus the account-wide addon SavedVariables.
let tempDir;
let wowPath;
let lootLog;

const at = (isoOrMs) => new Date(isoOrMs);

function makeCharacter(account, realm, name, mtime) {
  const dir = path.join(wowPath, 'WTF', 'Account', account, realm, name);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'chat-cache.txt');
  writeFileSync(file, 'x');
  utimesSync(file, at(mtime), at(mtime));
}

function writeAddonSv(account, characterName, atSeconds) {
  const dir = path.join(wowPath, 'WTF', 'Account', account, 'SavedVariables');
  mkdirSync(dir, { recursive: true });
  const character = characterName ? `["character"] = { ["name"] = "${characterName}", ["realm"] = "Argent Dawn", ["at"] = ${atSeconds} },` : '';
  writeFileSync(path.join(dir, 'GuildToolsLoot.lua'), `GuildToolsLootDB = {\n${character}\n["records"] = {},\n["trades"] = {},\n["needLosses"] = {},\n}\n`);
}

function writeToc(dir, version) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'GuildToolsLoot.toc');
  writeFileSync(file, `## Interface: 120100\n## Title: Guild Tools Loot\n## Version: ${version}\n## SavedVariables: GuildToolsLootDB\n\nGuildToolsLoot.lua\n`);
  return file;
}

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-lootlog-'));
  wowPath = path.join(tempDir, 'wow');
  mkdirSync(path.join(wowPath, 'WTF', 'Account'), { recursive: true });
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  lootLog = await import('./lootLog.cjs');
  lootLog.setWowPath(wowPath);
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('detectCharacterFromWtf', () => {
  it('picks the character folder written most recently, across realms and accounts', () => {
    makeCharacter('88#1', 'Argent Dawn', 'Elishock', '2026-09-18T17:53:00Z');
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T13:20:00Z');
    makeCharacter('88#2', 'Dalaran', 'Charguel', '2026-09-14T15:20:00Z');
    expect(lootLog.detectCharacterFromWtf(wowPath)).toMatchObject({ name: 'Elishaunt', realm: 'Argent Dawn' });
  });

  it('ignores the account-level SavedVariables folder (its children are addon files, not characters)', () => {
    writeAddonSv('88#2', 'Whoever', 1);
    expect(lootLog.detectCharacterFromWtf(wowPath)).toBeNull();
  });

  it('returns null when there are no character folders at all', () => {
    expect(lootLog.detectCharacterFromWtf(wowPath)).toBeNull();
  });
});

describe('resolveCharacter', () => {
  it('a manual override always wins', () => {
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T13:20:00Z');
    lootLog.setCharacterName('Elishock');
    expect(lootLog.resolveCharacter()).toEqual({ name: 'Elishock', source: 'manual' });
  });

  it('uses the character the addon recorded at login', () => {
    writeAddonSv('88#2', 'Elishaunt', Math.floor(Date.parse('2026-09-19T12:38:00Z') / 1000));
    expect(lootLog.resolveCharacter()).toEqual({ name: 'Elishaunt', source: 'addon' });
  });

  it('falls back to the newest WoW-folder character when the addon has recorded nothing (an older addon build)', () => {
    writeAddonSv('88#2', null, 0);
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T13:20:00Z');
    expect(lootLog.resolveCharacter()).toEqual({ name: 'Elishaunt', source: 'wtf' });
  });

  it('prefers whichever flush is clearly newer when the addon and the WoW folder disagree', () => {
    // Addon last recorded Elishock a day ago; the client has since saved Elishaunt (played with an older addon build).
    writeAddonSv('88#2', 'Elishock', Math.floor(Date.parse('2026-09-18T17:00:00Z') / 1000));
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T13:20:00Z');
    expect(lootLog.resolveCharacter().name).toBe('Elishaunt');
  });

  it('trusts the addon when both flushes are the same session (WoW folder stamps the logout, the addon the login)', () => {
    writeAddonSv('88#2', 'Elishaunt', Math.floor(Date.parse('2026-09-19T12:38:00Z') / 1000));
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T12:38:30Z');
    makeCharacter('88#2', 'Argent Dawn', 'Elishock', '2026-09-19T12:38:20Z');
    expect(lootLog.resolveCharacter()).toEqual({ name: 'Elishaunt', source: 'addon' });
  });

  it('reports nothing when there is nothing to detect', () => {
    expect(lootLog.resolveCharacter()).toEqual({ name: null, source: null });
  });

  it('surfaces the effective name, its source and any override through getWowPathConfig', () => {
    makeCharacter('88#2', 'Argent Dawn', 'Elishaunt', '2026-09-19T13:20:00Z');
    expect(lootLog.getWowPathConfig()).toMatchObject({ characterName: 'Elishaunt', characterSource: 'wtf', characterOverride: null });
    lootLog.setCharacterName('Elishock');
    expect(lootLog.getWowPathConfig()).toMatchObject({ characterName: 'Elishock', characterSource: 'manual', characterOverride: 'Elishock' });
    lootLog.setCharacterName('');
    expect(lootLog.getWowPathConfig().characterOverride).toBeNull();
  });
});

describe('getAddonVersionInfo', () => {
  const installedDir = () => path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLoot');

  it('reports outdated when the installed addon is older than the bundled one', () => {
    const bundled = writeToc(path.join(tempDir, 'bundled'), '1.5');
    writeToc(installedDir(), '1.4');
    expect(lootLog.getAddonVersionInfo(bundled)).toEqual({ bundled: '1.5', installed: '1.4', status: 'outdated' });
  });

  it('reports current when versions match, or the installed one is newer', () => {
    const bundled = writeToc(path.join(tempDir, 'bundled'), '1.5');
    writeToc(installedDir(), '1.5');
    expect(lootLog.getAddonVersionInfo(bundled).status).toBe('current');
    writeToc(installedDir(), '1.6');
    expect(lootLog.getAddonVersionInfo(bundled).status).toBe('current');
  });

  it('compares numerically, not as text ("1.10" is newer than "1.9")', () => {
    const bundled = writeToc(path.join(tempDir, 'bundled'), '1.10');
    writeToc(installedDir(), '1.9');
    expect(lootLog.getAddonVersionInfo(bundled).status).toBe('outdated');
    expect(lootLog.compareVersions('1.10', '1.9')).toBe(1);
    expect(lootLog.compareVersions('1.5', '1.5.0')).toBe(0);
  });

  it('reports not_installed when there is no addon folder', () => {
    const bundled = writeToc(path.join(tempDir, 'bundled'), '1.5');
    expect(lootLog.getAddonVersionInfo(bundled)).toEqual({ bundled: '1.5', installed: null, status: 'not_installed' });
  });

  it('reports no_wow when the WoW folder is not valid', async () => {
    vi.resetModules();
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'gt-lootlog-nowow-'));
    const fresh = await import('./lootLog.cjs');
    fresh.setWowPath(path.join(tempDir, 'nope'));
    // Only meaningful if this dev machine has no real WoW at the hardcoded default path.
    if (fresh.isRealWowPath('C:\\Program Files (x86)\\World of Warcraft\\_retail_')) return;
    expect(fresh.getAddonVersionInfo(writeToc(path.join(tempDir, 'bundled'), '1.5')).status).toBe('no_wow');
  });
});

describe('normalizeCalendar', () => {
  it('turns the addon calendar into events with a coming/maybe/no answer per invitee, soonest first', async () => {
    const { normalizeCalendar } = await import('./lootLog.cjs');
    const { readLuaVariable } = await import('./luaTableReader.cjs');
    const saved = `GuildToolsLootTestDB = {
      ["calendar"] = {
        ["scannedAt"] = 1790000000,
        ["events"] = {
          { ["title"] = "Raid", ["start"] = "2026-10-03T19:00", ["calendarType"] = "GUILD_EVENT", ["note"] = "the game didn't open this event in time" },
          { ["title"] = "M+ Night", ["start"] = "2026-09-29T20:30", ["calendarType"] = "GUILD_EVENT", ["invites"] = {
            { ["name"] = "Narima", ["className"] = "Death Knight", ["status"] = "available" },
            { ["name"] = "Odasa-ArgentDawn", ["className"] = "Shaman", ["status"] = "tentative" },
            { ["name"] = "Silverhorn", ["className"] = "Paladin", ["status"] = "declined" },
          } },
        },
      },
    }`;
    const cal = normalizeCalendar(readLuaVariable(saved, 'GuildToolsLootTestDB'));
    expect(cal.scannedAt).toBe(1790000000 * 1000);
    expect(cal.events.map((e) => e.title)).toEqual(['M+ Night', 'Raid']);
    expect(cal.events[0].invites.map((i) => [i.name, i.answer])).toEqual([['Narima', 'coming'], ['Odasa', 'maybe'], ['Silverhorn', 'no']]);
    expect(cal.events[1].invites).toBeNull();
  });

  it('is null when the addon has never saved a calendar', async () => {
    const { normalizeCalendar } = await import('./lootLog.cjs');
    expect(normalizeCalendar({ records: [] })).toBeNull();
    expect(normalizeCalendar(null)).toBeNull();
  });
});
