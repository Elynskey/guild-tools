import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Same isolation pattern as lootRecordsStore.test.mjs: a fresh temp dir per test acts as
// both the fake WoW installation (wow-path.json points at it) and DATA_DIR (so the
// tailer's own offset-state file doesn't leak between tests).
let tempDir;
let wowPath;
let chatLogFile;
let tail;
let lootLog;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-chat-tail-'));
  wowPath = path.join(tempDir, 'wow');
  mkdirSync(path.join(wowPath, 'WTF'), { recursive: true });
  mkdirSync(path.join(wowPath, 'Logs'), { recursive: true });
  chatLogFile = path.join(wowPath, 'Logs', 'WoWChatLog.txt');

  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  lootLog = await import('./lootLog.cjs');
  lootLog.setWowPath(wowPath);
  tail = await import('./lootChatTail.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

// The REAL on-disk format (confirmed 2026-09-19 against a live WoWChatLog.txt) -- no
// brackets around "Loot", an optional ", Main-Spec"/"Off-Spec" qualifier, and no item
// hyperlink at all, just the plain item name. See lootChatTail.cjs's own comment for
// why this differs from the addon's in-game CHAT_MSG_LOOT text.
const WON_LINE = "9/18 21:49:26.420  Loot: Dharma (Need - 92, Main-Spec) Won: Cincture of the Abyssal Grotto";
const WON_LINE_SELF = '9/18 21:49:28.730  Loot: You (Need - 94, Main-Spec) Won: Tomb-Creeper\'s Claw';

describe('pollChatLog', () => {
  it('seeks to EOF on the very first poll of a new path and captures nothing pre-existing', () => {
    writeFileSync(chatLogFile, `some old line\n${WON_LINE}\n`);
    const first = tail.pollChatLog();
    expect(first.newRecords).toHaveLength(0);
  });

  it('parses a well-formed Need-win line appended after the first poll', () => {
    writeFileSync(chatLogFile, 'some old line\n');
    tail.pollChatLog(); // establishes the starting offset at current EOF

    appendFileSync(chatLogFile, `${WON_LINE}\n`);
    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0]).toMatchObject({
      itemId: null,
      winner: 'Dharma',
      boss: null,
      slot: null,
      difficulty: null,
      source: 'chat-tail',
    });
    expect(newRecords[0].itemLink).toBe('[Cincture of the Abyssal Grotto]');
  });

  it('resolves a self-win ("You" in the log) to the configured character name', () => {
    lootLog.setCharacterName('Vitaezra');
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();
    appendFileSync(chatLogFile, `${WON_LINE_SELF}\n`);
    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0].winner).toBe('Vitaezra');
    expect(newRecords[0].itemLink).toBe("[Tomb-Creeper's Claw]");
  });

  it('drops a self-win entirely when no character name is configured yet', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();
    appendFileSync(chatLogFile, `${WON_LINE_SELF}\n`);
    expect(tail.pollChatLog().newRecords).toHaveLength(0);
  });

  it('is case-insensitive on the roll type and ignores non-Need rolls', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();

    const greedLine = WON_LINE.replace('(Need - 92, Main-Spec)', '(Greed - 1)');
    const shoutyNeed = WON_LINE.replace('(Need - 92, Main-Spec)', '(NEED - 92, Off-Spec)');
    appendFileSync(chatLogFile, `${greedLine}\n${shoutyNeed}\n`);

    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0].winner).toBe('Dharma');
  });

  it('ignores chat lines with no Loot: shape', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();
    appendFileSync(chatLogFile, '9/6 22:15:00.000  |Hchannel:GUILD|h[Guild]|h Officer: pulling in 5\n');
    expect(tail.pollChatLog().newRecords).toHaveLength(0);
  });

  it('does not re-parse lines already consumed on a later poll', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();
    appendFileSync(chatLogFile, `${WON_LINE}\n`);
    expect(tail.pollChatLog().newRecords).toHaveLength(1);
    expect(tail.pollChatLog().newRecords).toHaveLength(0);

    appendFileSync(chatLogFile, `${WON_LINE}\n`);
    expect(tail.pollChatLog().newRecords).toHaveLength(1);
  });

  it('holds back a trailing line with no terminating newline until it is completed', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();

    appendFileSync(chatLogFile, WON_LINE); // no trailing \n -- WoW may still be mid-write
    expect(tail.pollChatLog().newRecords).toHaveLength(0);

    appendFileSync(chatLogFile, '\n');
    expect(tail.pollChatLog().newRecords).toHaveLength(1);
  });

  it('resets to offset 0 when the file is shorter than the last recorded offset (new session)', () => {
    // Padded so the first "session" ends at a large offset -- a same-length rewrite
    // wouldn't actually exercise the shrink-detection branch below.
    writeFileSync(chatLogFile, `padding padding padding padding padding\n${WON_LINE}\n`);
    tail.pollChatLog(); // seeks to EOF of the first "session"

    // Simulate WoW recreating the log fresh (shorter) on a new session.
    writeFileSync(chatLogFile, `${WON_LINE}\n`);
    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
  });

  it('reports not_configured when the configured WoW path has no WTF folder', async () => {
    vi.resetModules();
    const badWowPath = mkdtempSync(path.join(tmpdir(), 'gt-chat-tail-bad-wow-path-'));
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'gt-chat-tail-unconfigured-'));
    const badLootLog = await import('./lootLog.cjs');
    badLootLog.setWowPath(badWowPath); // no WTF subfolder -- isRealWowPath rejects it
    const unconfiguredTail = await import('./lootChatTail.cjs');
    // Only meaningful if this dev machine has no real WoW install at lootLog.cjs's
    // hardcoded Windows default path for resolveWowPath() to fall back to.
    if (badLootLog.isRealWowPath('C:\\Program Files (x86)\\World of Warcraft\\_retail_')) return;
    expect(unconfiguredTail.pollChatLog()).toEqual({ status: 'not_configured', newRecords: [] });
    expect(unconfiguredTail.getChatLogStatus()).toMatchObject({ path: null, exists: false, active: false, state: 'unknown' });
  });
});

describe('lineTimeSeconds: a win takes the time written on its own log line', () => {
  const at = (y, mo, d, h, mi, s) => new Date(y, mo - 1, d, h, mi, s).getTime();

  it('reads the line\'s own stamp (local time, no year), not the moment it was read', () => {
    const now = at(2026, 9, 19, 23, 4, 14);
    expect(tail.lineTimeSeconds('9/19 22:59:38.969  Loot: You (Need - 100, Main-Spec) Won: X', now)).toBe(Math.floor(at(2026, 9, 19, 22, 59, 38) / 1000));
  });

  it('a record read minutes after it was logged (a flush) keeps the logged time, so it lines up with the addon\'s copy', () => {
    writeFileSync(chatLogFile, 'old\n');
    tail.pollChatLog();
    const flushedAt = Date.now();
    const d = new Date(flushedAt - 5 * 60 * 1000);
    const stamp = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.100`;
    appendFileSync(chatLogFile, `${stamp}  Loot: Dharma (Need - 92, Main-Spec) Won: Cincture of the Abyssal Grotto\n`);
    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
    const ageSeconds = flushedAt / 1000 - newRecords[0].time;
    expect(ageSeconds).toBeGreaterThan(290);
    expect(ageSeconds).toBeLessThan(320);
  });

  it('a stamp a day or more ahead belongs to last year (a log flushed just after New Year)', () => {
    const now = at(2026, 1, 1, 0, 5, 0);
    expect(tail.lineTimeSeconds('12/31 23:59:50.000  Loot: x', now)).toBe(Math.floor(at(2025, 12, 31, 23, 59, 50) / 1000));
  });

  it('a stamp a little ahead of now is clamped to now, never the future', () => {
    const now = at(2026, 9, 19, 23, 4, 14);
    expect(tail.lineTimeSeconds('9/19 23:04:20.000  Loot: x', now)).toBe(Math.floor(now / 1000));
  });

  it('a line with no readable stamp gives null and the record falls back to the read time', () => {
    expect(tail.lineTimeSeconds('Loot: Dharma (Need - 92) Won: X', Date.now())).toBeNull();
    expect(tail.lineTimeSeconds('13/45 25:99:99  Loot: x', Date.now())).toBeNull();
    writeFileSync(chatLogFile, 'old\n');
    tail.pollChatLog();
    const before = Math.floor(Date.now() / 1000);
    appendFileSync(chatLogFile, 'Loot: Dharma (Need - 92, Main-Spec) Won: Cincture of the Abyssal Grotto\n');
    const { newRecords } = tail.pollChatLog();
    expect(newRecords[0].time).toBeGreaterThanOrEqual(before);
  });
});

describe('getChatLogStatus', () => {
  it('reports exists+active for a file just written to', () => {
    writeFileSync(chatLogFile, `${WON_LINE}\n`);
    const status = tail.getChatLogStatus();
    expect(status.exists).toBe(true);
    expect(status.active).toBe(true);
    expect(status.path).toBe(chatLogFile);
  });

  it('reports exists but not active for a file untouched for a long time', () => {
    writeFileSync(chatLogFile, `${WON_LINE}\n`);
    const old = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    utimesSync(chatLogFile, old, old);
    const status = tail.getChatLogStatus();
    expect(status.exists).toBe(true);
    expect(status.active).toBe(false);
  });

  it('reports not exists when the log file has never been created', () => {
    const status = tail.getChatLogStatus();
    expect(status.exists).toBe(false);
    expect(status.active).toBe(false);
    expect(status.path).toBe(chatLogFile);
  });
});

describe('getChatLogStatus: the game own reading beats a stale file (WoW buffers the chat log until you log out)', () => {
  const savedVarsDir = () => path.join(wowPath, 'WTF', 'Account', 'ACCT', 'SavedVariables');
  const writeReading = (on, at = 1_800_000_000) => {
    mkdirSync(savedVarsDir(), { recursive: true });
    writeFileSync(path.join(savedVarsDir(), 'GuildToolsLoot.lua'), `GuildToolsLootDB = {
  ["records"] = {},
  ["trades"] = {},
  ["needLosses"] = {},
  ["chatLogging"] = {
    ["on"] = ${on},
    ["at"] = ${at},
  },
}
`);
  };
  const staleLog = () => {
    writeFileSync(chatLogFile, `${WON_LINE}
`);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    utimesSync(chatLogFile, old, old);
  };

  it('a stale file with the game saying ON is "on-buffered", not off', () => {
    staleLog();
    writeReading('true');
    const status = tail.getChatLogStatus();
    expect(status.active).toBe(false);
    expect(status.state).toBe('on-buffered');
    expect(status.gameReading).toEqual({ on: true, at: 1_800_000_000_000 });
  });

  it('only the game saying OFF is reported as off', () => {
    staleLog();
    writeReading('false');
    expect(tail.getChatLogStatus().state).toBe('off');
  });

  it('a stale file and no reading (older addon) is "unknown", never "off"', () => {
    staleLog();
    const status = tail.getChatLogStatus();
    expect(status.gameReading).toBeNull();
    expect(status.state).toBe('unknown');
  });

  it('a file written just now is "writing" whatever an old reading says', () => {
    writeFileSync(chatLogFile, `${WON_LINE}
`);
    writeReading('false');
    expect(tail.getChatLogStatus().state).toBe('writing');
  });

  it('a new reading is picked up when the saved file changes, not served from the cache', () => {
    staleLog();
    writeReading('true');
    expect(tail.getChatLogStatus().state).toBe('on-buffered');
    writeReading('false');
    const later = new Date(Date.now() + 5000);
    utimesSync(path.join(savedVarsDir(), 'GuildToolsLoot.lua'), later, later);
    expect(tail.getChatLogStatus().state).toBe('off');
  });

  it('the file being missing does not stop the game reading from counting', () => {
    writeReading('true');
    const status = tail.getChatLogStatus();
    expect(status.exists).toBe(false);
    expect(status.state).toBe('on-buffered');
  });
});
