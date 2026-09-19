import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let tempDir;
let wowPath;
let logsDir;
let combat;
let enrich;
let store;
let lootLog;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-live-'));
  wowPath = path.join(tempDir, 'wow');
  logsDir = path.join(wowPath, 'Logs');
  mkdirSync(path.join(wowPath, 'WTF'), { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  lootLog = await import('./lootLog.cjs');
  lootLog.setWowPath(wowPath);
  combat = await import('./lootCombatLog.cjs');
  enrich = await import('./lootLiveEnrich.cjs');
  store = await import('./lootRecordsStore.cjs');
  combat.resetForTests();
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

// Real lines from the 9/18 raid night's combat log (local time, UTC-5).
const KILL_ULATEK = `9/18/2026 21:01:53.674-5  ENCOUNTER_END,3492,"Ula'tek",14,23,1,438881`;
const WIPE_ULATEK = `9/18/2026 20:43:16.682-5  ENCOUNTER_END,3492,"Ula'tek",14,23,0,117927`;
const KILL_NEKZALI_HEROIC = `9/18/2026 21:48:28.560-5  ENCOUNTER_END,3373,"Nek'zali the Soulcoiler",15,23,1,470000`;
const NOISE = `9/18/2026 21:01:50.100-5  SPELL_DAMAGE,Player-1-0A,"Odasa-ArgentDawn",0x511,0x0,Creature-0,"Ula'tek",0x10a48,0x0,12345,"Lightning Bolt"`;
const utc = (isoLocalMinus5) => Date.parse(isoLocalMinus5 + '-05:00');

describe('parseKills', () => {
  it('reads kills with the right boss, difficulty and a UTC time, and ignores wipes and everything else', () => {
    const kills = combat.parseKills([NOISE, WIPE_ULATEK, KILL_ULATEK, KILL_NEKZALI_HEROIC].join('\r\n'));
    expect(kills).toHaveLength(2);
    expect(kills[0]).toEqual({ boss: "Ula'tek", encounterId: 3492, difficultyId: 14, endedAt: utc('2026-09-18T21:01:53.674') });
    expect(kills[1]).toMatchObject({ boss: "Nek'zali the Soulcoiler", difficultyId: 15 });
  });

  it('honours the offset in the timestamp rather than assuming a timezone', () => {
    const [k] = combat.parseKills(`9/18/2026 21:01:53.674+1  ENCOUNTER_END,1,"X",14,20,1,1000`);
    expect(k.endedAt).toBe(Date.UTC(2026, 8, 18, 20, 1, 53, 674));
  });
});

describe('enrichWin', () => {
  const lootTable = {
    bosses: [{ id: 1, name: 'Nymrissa Wavecaller' }, { id: 2, name: "Ula'tek" }],
    lootByBoss: { 'Nymrissa Wavecaller': [10], "Ula'tek": [20] },
    items: { 10: { name: "Wavecaller's Seastone", slot: 'Trinket' }, 20: { name: 'Known Ulatek Helm', slot: 'Head' } },
  };
  const NOW = 1_800_000_000;
  const kill = (boss, difficultyId, agoSeconds) => ({ boss, difficultyId, endedAt: (NOW - agoSeconds) * 1000 });
  const win = (name, over = {}) => ({ itemId: null, itemLink: `[${name}]`, winner: 'Ranikina', boss: null, slot: null, difficulty: null, source: 'chat-tail', time: NOW, ...over });

  it('a known item that drops from the boss just killed gets boss, slot, difficulty and becomes live', () => {
    const r = enrich.enrichWin(win("Wavecaller's Seastone"), { lootTable, kills: [kill('Nymrissa Wavecaller', 15, 60)] });
    expect(r).toMatchObject({ itemId: 10, boss: 'Nymrissa Wavecaller', slot: 'Trinket', difficulty: 'Heroic', source: 'live' });
  });

  it('a known item that does NOT drop from the recently killed boss is left unattributed (but its id is resolved)', () => {
    const r = enrich.enrichWin(win("Wavecaller's Seastone"), { lootTable, kills: [kill("Ula'tek", 14, 60)] });
    expect(r.source).toBe('chat-tail');
    expect(r.boss).toBeNull();
    expect(r.itemId).toBe(10);
  });

  it('an item missing from the table is attributed to a just-killed tier boss, without a slot', () => {
    const r = enrich.enrichWin(win('Font of Venomous Rage'), { lootTable, kills: [kill("Ula'tek", 14, 164)] });
    expect(r).toMatchObject({ boss: "Ula'tek", difficulty: 'Normal', source: 'live', slot: null, itemId: null });
  });

  it('an unknown item is NOT attributed once the kill is more than five minutes old', () => {
    const r = enrich.enrichWin(win('Font of Venomous Rage'), { lootTable, kills: [kill("Ula'tek", 14, 6 * 60)] });
    expect(r.source).toBe('chat-tail');
  });

  it('an unknown item is NOT attributed to a boss outside this tier', () => {
    const r = enrich.enrichWin(win('Font of Venomous Rage'), { lootTable, kills: [kill('Some Old Raid Boss', 15, 30)] });
    expect(r.source).toBe('chat-tail');
  });

  it('never attributes a recipe-named item, and never a Mythic/LFR kill', () => {
    expect(enrich.enrichWin(win('Recipe: Flask of Things'), { lootTable, kills: [kill("Ula'tek", 14, 30)] }).source).toBe('chat-tail');
    expect(enrich.enrichWin(win('Font of Venomous Rage'), { lootTable, kills: [kill("Ula'tek", 16, 30)] }).source).toBe('chat-tail'); // Mythic
    expect(enrich.enrichWin(win('Font of Venomous Rage'), { lootTable, kills: [kill("Ula'tek", 17, 30)] }).source).toBe('chat-tail'); // LFR
  });

  it('with no loot table or no kills, returns the record unchanged', () => {
    const r = win('Font of Venomous Rage');
    expect(enrich.enrichWin(r, { lootTable: null, kills: [kill("Ula'tek", 14, 30)] })).toBe(r);
    expect(enrich.enrichWin(r, { lootTable, kills: [] })).toBe(r);
  });

  it('picks the newest kill whose loot matches when two bosses died recently', () => {
    const r = enrich.enrichWin(win('Known Ulatek Helm'), { lootTable, kills: [kill('Nymrissa Wavecaller', 15, 30), kill("Ula'tek", 14, 200)] });
    expect(r.boss).toBe("Ula'tek");
  });
});

describe('pollCombatLog', () => {
  const logFile = (name = 'WoWCombatLog-091826_195511.txt') => path.join(logsDir, name);

  it('reports not_configured/no_log when there is nothing to read', () => {
    expect(combat.pollCombatLog()).toEqual({ status: 'no_log' });
    expect(combat.getCombatLogStatus()).toMatchObject({ exists: false, active: false, lastKill: null });
  });

  it('on first sight catches up on a kill already in the tail (app opened mid-raid), and skips older history', () => {
    writeFileSync(logFile(), [`9/17/2026 20:00:00.000-5  ENCOUNTER_END,1,"Old Boss",15,20,1,1000`, NOISE, KILL_ULATEK, ''].join('\r\n'));
    combat.pollCombatLog();
    const kills = combat.recentKills(utc('2026-09-18T21:03:00.000'));
    expect(kills.map((k) => k.boss)).toEqual(["Ula'tek"]); // the 9/17 kill is far outside the window
  });

  it('picks up a kill appended after the first poll, and only once', () => {
    writeFileSync(logFile(), NOISE + '\r\n');
    combat.pollCombatLog();
    appendFileSync(logFile(), KILL_ULATEK + '\r\n');
    combat.pollCombatLog();
    combat.pollCombatLog();
    expect(combat.recentKills(utc('2026-09-18T21:03:00.000'))).toHaveLength(1);
  });

  it('holds back a half-written line until it is complete', () => {
    writeFileSync(logFile(), NOISE + '\r\n');
    combat.pollCombatLog();
    appendFileSync(logFile(), KILL_ULATEK.slice(0, 40)); // WoW is mid-write
    combat.pollCombatLog();
    expect(combat.recentKills(utc('2026-09-18T21:03:00.000'))).toHaveLength(0);
    appendFileSync(logFile(), KILL_ULATEK.slice(40) + '\r\n');
    combat.pollCombatLog();
    expect(combat.recentKills(utc('2026-09-18T21:03:00.000'))).toHaveLength(1);
  });

  it('follows a brand-new combat log file when logging is switched off and on', () => {
    writeFileSync(logFile('WoWCombatLog-091826_195511.txt'), NOISE + '\r\n');
    const older = new Date(Date.now() - 3600_000);
    utimesSync(logFile('WoWCombatLog-091826_195511.txt'), older, older);
    combat.pollCombatLog();
    writeFileSync(logFile('WoWCombatLog-091826_230000.txt'), KILL_NEKZALI_HEROIC + '\r\n'); // starts with a kill on line 1
    combat.pollCombatLog();
    expect(combat.recentKills(utc('2026-09-18T21:50:00.000')).map((k) => k.boss)).toEqual(["Nek'zali the Soulcoiler"]);
  });

  it('only offers kills inside the age window, newest first', () => {
    writeFileSync(logFile(), '');
    combat.pollCombatLog();
    appendFileSync(logFile(), [KILL_ULATEK, KILL_NEKZALI_HEROIC, ''].join('\r\n'));
    combat.pollCombatLog();
    const twoHours = 2 * 3600 * 1000;
    expect(combat.recentKills(utc('2026-09-18T21:49:00.000'), twoHours).map((k) => k.boss)).toEqual(["Nek'zali the Soulcoiler", "Ula'tek"]); // newest first
    expect(combat.recentKills(utc('2026-09-18T21:49:00.000')).map((k) => k.boss)).toEqual(["Nek'zali the Soulcoiler"]); // default 10 min: the 21:01 kill is out
    expect(combat.recentKills(utc('2026-09-18T22:30:00.000'))).toEqual([]);
  });

  it('reports the log as active when just written, plus the last kill seen', () => {
    writeFileSync(logFile(), KILL_ULATEK + '\r\n');
    combat.pollCombatLog();
    const s = combat.getCombatLogStatus();
    expect(s).toMatchObject({ exists: true, active: true });
    expect(s.lastKill.boss).toBe("Ula'tek");
  });
});

describe('live records in the store', () => {
  const NOW = 1_800_000_000;
  const live = (over = {}) => ({ itemId: 10, itemLink: "[Wavecaller's Seastone]", winner: 'Ranikina', boss: 'Nymrissa Wavecaller', slot: 'Trinket', difficulty: 'Heroic', source: 'live', time: NOW, ...over });
  const fromAddon = (over = {}) => ({ itemId: 10, itemLink: "|cff|Hitem:10|h[Wavecaller's Seastone]|h|r", winner: 'Ranikina', boss: 'Nymrissa Wavecaller', slot: 'Trinket', difficulty: 'Heroic', time: NOW + 20, ...over });

  it('a newly added live record counts as verified (that is what lets auto-post fire with no /reload)', () => {
    const r = store.sync([live()], [], []);
    expect(r.verifiedRecords).toHaveLength(1);
    expect(r.records[0].source).toBe('live');
  });

  it('a bare chat-tail record does not', () => {
    expect(store.sync([live({ source: 'chat-tail', boss: null, difficulty: null })], [], []).verifiedRecords).toHaveLength(0);
  });

  it('two officers\' apps capturing the same live win do not duplicate it', () => {
    store.sync([live()], [], []);
    const second = store.sync([live({ time: NOW + 3 })], [], []);
    expect(second.records).toHaveLength(1);
    expect(second.verifiedRecords).toHaveLength(0);
  });

  it('the addon\'s later record replaces the app\'s guesses where they differ, and clears the live marker', () => {
    store.sync([live({ boss: 'Wrong Boss', slot: null })], [], []);
    const r = store.sync([fromAddon()], [], []);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ boss: 'Nymrissa Wavecaller', slot: 'Trinket', difficulty: 'Heroic' });
    expect(r.records[0].source).toBeUndefined();
  });

  it('a slot-less live record (item not in the table) gets its slot from the addon later', () => {
    store.sync([live({ itemId: null, slot: null, itemLink: '[Font of Venomous Rage]' })], [], []);
    const r = store.sync([fromAddon({ itemId: 99, itemLink: '|cff|Hitem:99|h[Font of Venomous Rage]|h|r', slot: 'Trinket' })], [], []);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ slot: 'Trinket', itemId: 99 });
  });
});
