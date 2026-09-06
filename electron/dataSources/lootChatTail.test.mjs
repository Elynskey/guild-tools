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

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-chat-tail-'));
  wowPath = path.join(tempDir, 'wow');
  mkdirSync(path.join(wowPath, 'WTF'), { recursive: true });
  mkdirSync(path.join(wowPath, 'Logs'), { recursive: true });
  chatLogFile = path.join(wowPath, 'Logs', 'WoWChatLog.txt');

  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  const lootLog = await import('./lootLog.cjs');
  lootLog.setWowPath(wowPath);
  tail = await import('./lootChatTail.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

const WON_LINE = "9/6 22:15:03.123  [Loot]: Dharma (Need - 92) Won: |cff9d9d9d|Hitem:268232::::::::90:577::3:5:43:13696:13662:13333:12834:1:28:7359:::::|h[Cincture of the Abyssal Grotto]|h|r";

describe('getChatLogStatus', () => {
  it('reports not existing when the file has never been created', () => {
    expect(tail.getChatLogStatus()).toEqual({ path: chatLogFile, exists: false, active: false });
  });

  it('reports active for a just-written file', () => {
    writeFileSync(chatLogFile, 'hello\n');
    const status = tail.getChatLogStatus();
    expect(status.exists).toBe(true);
    expect(status.active).toBe(true);
  });

  it('reports inactive for a file with an old mtime', () => {
    writeFileSync(chatLogFile, 'hello\n');
    const old = new Date(Date.now() - 20 * 60 * 1000);
    utimesSync(chatLogFile, old, old);
    expect(tail.getChatLogStatus().active).toBe(false);
  });
});

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
      itemId: 268232,
      winner: 'Dharma',
      boss: null,
      slot: null,
      source: 'chat-tail',
    });
    expect(newRecords[0].itemLink).toContain('[Cincture of the Abyssal Grotto]');
  });

  it('is case-insensitive on the roll type and ignores non-Need rolls', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();

    const greedLine = WON_LINE.replace('(Need - 92)', '(Greed - 1)');
    const shoutyNeed = WON_LINE.replace('(Need - 92)', '(NEED - 92)');
    appendFileSync(chatLogFile, `${greedLine}\n${shoutyNeed}\n`);

    const { newRecords } = tail.pollChatLog();
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0].winner).toBe('Dharma');
  });

  it('ignores chat lines with no [Loot]: shape', () => {
    writeFileSync(chatLogFile, '');
    tail.pollChatLog();
    appendFileSync(chatLogFile, '9/6 22:15:00.000  [Raid] Officer: pulling in 5\n');
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
    const lootLog = await import('./lootLog.cjs');
    lootLog.setWowPath(badWowPath); // no WTF subfolder -- isRealWowPath rejects it
    const unconfiguredTail = await import('./lootChatTail.cjs');
    // Only meaningful if this dev machine has no real WoW install at lootLog.cjs's
    // hardcoded Windows default path for resolveWowPath() to fall back to.
    if (lootLog.isRealWowPath('C:\\Program Files (x86)\\World of Warcraft\\_retail_')) return;
    expect(unconfiguredTail.pollChatLog()).toEqual({ status: 'not_configured', newRecords: [] });
    expect(unconfiguredTail.getChatLogStatus()).toEqual({ path: null, exists: false, active: false });
  });
});
