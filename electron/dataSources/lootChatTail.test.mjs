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
    expect(unconfiguredTail.getChatLogStatus()).toEqual({ path: null, exists: false, active: false });
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
