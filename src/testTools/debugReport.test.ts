import { describe, expect, it } from 'vitest';
import type { LootMonitorSnapshot, LootRawFeeds } from '../electron';
import { buildDebugReport } from './debugReport';
import { evaluateLootPipeline } from './lootPipelineHealth';

const NOW = 1_800_000_000_000;

const snapshot: LootMonitorSnapshot = {
  now: NOW,
  wow: { configured: 'C:/WoW', resolved: 'C:/WoW', valid: true, characterName: 'Elishaunt', characterSource: 'addon', characterOverride: null },
  addon: { bundled: '1.6-test', installed: '1.6-test', status: 'current' },
  chatLog: { path: 'C:/secret/path/WoWChatLog.txt', exists: true, active: true, lastWriteAt: NOW - 10_000, sizeBytes: 5000 },
  combatLog: { exists: true, active: true, lastKill: null },
  session: { lastPollAt: NOW - 2000, lastStatus: 'ok', capturedThisSession: 2, lastCaptureAt: NOW - 60_000 },
  sessionStartedAt: NOW - 3_600_000,
  kills: [{ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - 300_000 }],
  addonData: { status: 'ok', wins: 3, losses: 1, trades: 0, lastWinAt: null, recentWins: [] },
  events: [
    { id: 1, at: NOW - 290_000, kind: 'chat-win', text: 'Thundoor won Crown (Need)', meta: null },
    { id: 2, at: NOW - 100_000, kind: 'store-sync', text: 'Pushed 1 live win(s) to the loot store', meta: null },
  ],
};
const feeds: LootRawFeeds = {
  lootLines: { available: true, lines: [{ time: '9/20 19:28:35.055', kind: 'need-win', text: "Loot: Thundoor (Need - 88, Main-Spec) Won: Crown of the Eternal Fang" }, { time: '9/20 19:28:30.000', kind: 'personal-loot', text: 'Devkra receives loot: [Ring].' }] },
  pulls: { available: true, pulls: [{ boss: "Ula'tek", encounterId: 3492, difficultyId: 15, kill: true, at: NOW - 300_000 }, { boss: "Ula'tek", encounterId: 3492, difficultyId: 15, kill: false, at: NOW - 900_000 }] },
};
const config = { autoPostLoot: true, channelId: '1548097098921025617' };
const store = [{ time: Math.floor((NOW - 100_000) / 1000), source: 'live' as const, boss: "Ula'tek", difficulty: 'Heroic' }];

describe('buildDebugReport', () => {
  const health = evaluateLootPipeline(snapshot, store, { reporting: true, chatLogActive: true }, config);
  const report = buildDebugReport({ appVersion: '1.1.6', snapshot, health, feeds, store, config });

  it('has every section, in a stable order', () => {
    const at = (h: string) => report.indexOf(h);
    const order = ['== Checks ==', '== This PC ==', '== Boss kills seen', '== Timeline', '== Loot lines WoW wrote', '== Boss pulls in the combat log'];
    for (const h of order) expect(at(h)).toBeGreaterThan(-1);
    expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b));
    expect(report.split('\n')[0]).toContain('Guild Tools (Test) 1.1.6');
  });

  it('carries the facts you would want when something went wrong', () => {
    expect(report).toContain('Elishaunt');
    expect(report).toContain("Ula'tek (Heroic)");
    expect(report).toContain('KILL');
    expect(report).toContain('wipe');
    expect(report).toContain('{need-win}');
    expect(report).toContain('{personal-loot}');
    expect(report).toContain('[chat-win] Thundoor won Crown (Need)');
    expect(report).toMatch(/Test store: 1 record\(s\), 1 unconfirmed, 0 posted/);
    expect(report).toContain('Settings: auto-post on; test loot channel set');
  });

  it('contains no secrets: no Discord channel ID and no file paths', () => {
    expect(report).not.toContain('1548097098921025617');
    expect(report).not.toContain('C:/secret/path');
  });

  it('says plainly when the feeds or store could not be read, and when a setting is off', () => {
    const bare = buildDebugReport({ appVersion: '1.1.6', snapshot, health, feeds: { lootLines: { available: false, lines: [] }, pulls: { available: false, pulls: [] } }, store: null, config: { autoPostLoot: false, channelId: '' } });
    expect(bare).toContain('(chat log not readable)');
    expect(bare).toContain('(no combat log)');
    expect(bare).toContain('Test store: could not be read');
    expect(bare).toContain('auto-post OFF');
    expect(bare).toContain('NOT SET');
  });
});

describe('the Live view report', () => {
  const health = evaluateLootPipeline(snapshot, store, null);
  const live = buildDebugReport({ appVersion: '1.1.6', snapshot, health, feeds, store, config, view: 'live', officers: [{ officerName: 'Quixhea', chatLogActive: true }, { officerName: 'Odasa', chatLogActive: false }] });

  it('says it is the live, read-only view and calls the store the live one', () => {
    expect(live.split('\n')[0]).toContain('LIVE loot pipeline report (real guild, read-only)');
    expect(live).toMatch(/Live store: 1 record\(s\)/);
    expect(live).not.toContain('Test store');
    expect(live).toContain('loot channel set');
    expect(live).not.toContain('test loot channel');
  });

  it('lists the officer apps and does not pretend the test diary is the live timeline', () => {
    expect(live).toContain('Officer apps reporting: Quixhea (chat logging on), Odasa (chat logging not confirmed on)');
    expect(live).toContain('not applicable in the Live view');
    expect(live).not.toContain('[chat-win]');
  });

  it('still has no secrets', () => {
    expect(live).not.toContain('1548097098921025617');
  });
});

describe('the new server-side checks', () => {
  it('a missing store fails the proxy check; an unset test channel fails; auto-post off only warns', () => {
    const h = evaluateLootPipeline(snapshot, null, null, { autoPostLoot: false, channelId: '' });
    const by = (id: string) => h.checks.find((c) => c.id === id)!;
    expect(by('proxy').status).toBe('fail');
    expect(by('test-channel').status).toBe('fail');
    expect(by('auto-post').status).toBe('warn');
    expect(h.overall).toBe('fail');
  });
  it('all set is green', () => {
    const h = evaluateLootPipeline(snapshot, [], { reporting: true, chatLogActive: true }, { autoPostLoot: true, channelId: 'x' });
    for (const id of ['proxy', 'test-channel', 'auto-post']) expect(h.checks.find((c) => c.id === id)!.status).toBe('ok');
  });
  it('without a config the two setting checks are simply absent', () => {
    const h = evaluateLootPipeline(snapshot, [], null);
    expect(h.checks.some((c) => c.id === 'test-channel')).toBe(false);
  });
});
