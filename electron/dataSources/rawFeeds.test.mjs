import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recentEncounters, recentLootLines } from './rawFeeds.cjs';
import { classifyLootLine } from './lootChatTail.cjs';
import { enablePersistence, MAX_FILE_BYTES, record, recent, resetForTests } from './pipelineLog.cjs';
import { parseEncounters } from './lootCombatLog.cjs';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-raw-'));
  resetForTests();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('classifyLootLine', () => {
  it('sorts real chat-log loot lines by what they are', () => {
    expect(classifyLootLine('9/18 21:49:26.420  Loot: You (Need - 94, Main-Spec) Won: Tomb-Creeper\'s Claw').kind).toBe('need-win');
    expect(classifyLootLine('9/18 21:49:26.420  Loot: Thundoor (Greed - 41) Won: Old Boots').kind).toBe('other-roll-won');
    expect(classifyLootLine('9/18 21:49:20.000  Loot: Devkra has selected Need for: [Crown]').kind).toBe('need-selected');
    expect(classifyLootLine('9/18 21:49:21.000  Loot: Odasa passed on: [Crown]').kind).toBe('passed');
    expect(classifyLootLine('9/18 21:49:22.000  Ranikina receives loot: [Ring].').kind).toBe('personal-loot');
    expect(classifyLootLine('9/18 21:49:22.000  You receive loot: [Ring].').kind).toBe('personal-loot');
  });
  it('ignores lines that are not about loot', () => {
    expect(classifyLootLine('9/18 21:49:22.000  Tearali creates Harandar Celebration.')).toBeNull();
    expect(classifyLootLine('9/18 21:49:22.000  [Guild] Devkra: lets go')).toBeNull();
  });
});

describe('recentLootLines', () => {
  it('returns only loot lines, newest first, with the game\'s own timestamps', () => {
    const file = path.join(dir, 'WoWChatLog.txt');
    fs.writeFileSync(file, ['9/18 21:00:00.000  Hello there', '9/18 21:00:01.000  Loot: Devkra has selected Need for: [Crown]', '9/18 21:00:02.000  Loot: Devkra (Need - 90, Main-Spec) Won: Crown', '9/18 21:00:03.000  Someone creates Tea.', ''].join('\n'));
    const { available, lines } = recentLootLines(10, file);
    expect(available).toBe(true);
    expect(lines.map((l) => l.kind)).toEqual(['need-win', 'need-selected']);
    expect(lines[0].time).toBe('9/18 21:00:02.000');
    expect(lines[0].text.startsWith('Loot:')).toBe(true);
  });
  it('reports unavailable for a missing log, and respects the limit', () => {
    expect(recentLootLines(10, path.join(dir, 'nope.txt')).available).toBe(false);
    const file = path.join(dir, 'c.txt');
    fs.writeFileSync(file, Array.from({ length: 20 }, (_, i) => `9/18 21:00:${String(i).padStart(2, '0')}.000  Loot: X passed on: [I${i}]`).join('\n') + '\n');
    expect(recentLootLines(5, file).lines).toHaveLength(5);
  });
  it('reads only the tail of a big file and never returns a half line', () => {
    const file = path.join(dir, 'big.txt');
    const filler = 'x'.repeat(200) + '\n';
    fs.writeFileSync(file, filler.repeat(2000) + '9/18 21:00:00.000  Loot: Devkra (Need - 90) Won: Crown\n');
    const { lines } = recentLootLines(5, file);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('need-win');
  });
});

describe('boss pulls', () => {
  const START = '9/18/2026 21:01:53.674-5  ENCOUNTER_START,3492,"Ula\'tek",15,20,2337';
  const END_KILL = '9/18/2026 21:09:11.100-5  ENCOUNTER_END,3492,"Ula\'tek",15,20,1,437000';
  const END_WIPE = '9/18/2026 21:20:00.000-5  ENCOUNTER_END,3492,"Ula\'tek",15,20,0,120000';

  it('parses starts and ends, keeping wipes as well as kills', () => {
    const pulls = parseEncounters([START, END_WIPE, END_KILL].join('\n'));
    expect(pulls.map((p) => [p.kind, p.success])).toEqual([['start', null], ['end', false], ['end', true]]);
    expect(pulls[0]).toMatchObject({ boss: "Ula'tek", difficultyId: 15, encounterId: 3492 });
  });
  it('lists how each pull ended, newest first, from a combat log file', () => {
    const file = path.join(dir, 'WoWCombatLog-092026.txt');
    fs.writeFileSync(file, [START, END_WIPE, END_KILL, ''].join('\n'));
    const { available, pulls } = recentEncounters(10, file);
    expect(available).toBe(true);
    expect(pulls.map((p) => p.kill)).toEqual([true, false]);
    expect(pulls[0].boss).toBe("Ula'tek");
  });
  it('reports unavailable with no combat log', () => {
    expect(recentEncounters(10, path.join(dir, 'missing.txt')).available).toBe(false);
  });
});

describe('the pipeline diary on disk', () => {
  it('appends one JSON line per event, readable from outside the app', () => {
    const file = path.join(dir, 'pipeline-events.jsonl');
    enablePersistence(file);
    record('boss-kill', "Boss killed: Ula'tek", { difficultyId: 15 });
    record('chat-win', 'Thundoor won Crown (Need)');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.map((l) => l.kind)).toEqual(['boss-kill', 'chat-win']);
    expect(lines[0].iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(recent()).toHaveLength(2);
  });
  it('sets an oversized file aside instead of growing forever', () => {
    const file = path.join(dir, 'pipeline-events.jsonl');
    fs.writeFileSync(file, 'x'.repeat(MAX_FILE_BYTES + 10));
    enablePersistence(file);
    record('chat-win', 'fresh');
    expect(fs.existsSync(`${file}.old`)).toBe(true);
    expect(fs.readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(1);
  });
  it('a folder that cannot be written never breaks recording', () => {
    enablePersistence(path.join(dir, 'no', 'such', 'folder', 'x.jsonl'));
    expect(() => record('chat-win', 'still fine')).not.toThrow();
    expect(recent()).toHaveLength(1);
  });
});
