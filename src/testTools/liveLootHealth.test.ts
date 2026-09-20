import { describe, expect, it } from 'vitest';
import type { LootMonitorSnapshot } from '../electron';
import { evaluateLiveLoot } from './liveLootHealth';
import type { StoreRecordView } from './lootPipelineHealth';

const NOW = 1_800_000_000_000;
const sec = (msAgo: number) => Math.floor((NOW - msAgo) / 1000);
const min = 60_000;

const base: LootMonitorSnapshot = {
  now: NOW,
  wow: { configured: 'C:/WoW', resolved: 'C:/WoW', valid: true, characterName: 'Elishaunt', characterSource: 'addon', characterOverride: null },
  addon: { bundled: '1.1.5', installed: '1.1.5', status: 'current' },
  chatLog: { path: null, exists: true, active: true, lastWriteAt: NOW - 5000, sizeBytes: 100 },
  combatLog: { exists: true, active: true, lastKill: null },
  session: { lastPollAt: null, lastStatus: null, capturedThisSession: 0, lastCaptureAt: null },
  sessionStartedAt: NOW - 3_600_000,
  kills: [],
  addonData: { status: 'ok', wins: 4, losses: 1, trades: 0, lastWinAt: null, recentWins: [] },
  events: [],
};
const config = { autoPostLoot: true, channelId: '123' };
const officers = [{ officerName: 'Quixhea', chatLogActive: true }, { officerName: 'Odasa', chatLogActive: false }];
const posted = (msAgo: number): StoreRecordView => ({ time: sec(msAgo), boss: "Ula'tek", difficulty: 'Heroic', discordPostedAt: 'x' });
const by = (h: ReturnType<typeof evaluateLiveLoot>, id: string) => h.checks.find((c) => c.id === id)!;

describe('evaluateLiveLoot (the Live view, real guild, read-only)', () => {
  it('all healthy: covered, wins followed the kill, posted', () => {
    const snap = { ...base, kills: [{ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - 10 * min }] };
    const h = evaluateLiveLoot(snap, [posted(9 * min)], officers, config);
    expect(by(h, 'coverage').status).toBe('ok');
    expect(by(h, 'coverage').detail).toContain('Quixhea');
    expect(by(h, 'loot-after-kill').status).toBe('ok');
    expect(by(h, 'discord').status).toBe('ok');
    expect(h.overall).toBe('ok');
  });

  it('names the real addon and the real channel, never the test ones', () => {
    const h = evaluateLiveLoot(base, [], officers, config);
    expect(by(h, 'addon').label).toContain('GuildToolsLoot');
    expect(by(h, 'addon').label).not.toContain('Test addon');
    expect(by(h, 'channel').label).toBe('Loot log channel is set');
    expect(h.checks.some((c) => c.id === 'test-channel')).toBe(false);
    expect(h.checks.map((c) => c.detail).join(' ')).not.toMatch(/gtloottest|test store|test Discord/i);
  });

  it('nobody covering chat logging is a warning, with who is open', () => {
    const none = evaluateLiveLoot(base, [], [{ officerName: 'Odasa', chatLogActive: false }], config);
    expect(by(none, 'coverage').status).toBe('warn');
    expect(by(none, 'coverage').detail).toContain('Odasa');
    expect(by(evaluateLiveLoot(base, [], [], config), 'coverage').status).toBe('warn');
    expect(by(evaluateLiveLoot(base, [], null, config), 'coverage').status).toBe('idle');
  });

  it('a kill with no wins after it: idle while fresh, a warning once loot should have rolled', () => {
    const fresh = evaluateLiveLoot({ ...base, kills: [{ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - 1 * min }] }, [], officers, config);
    expect(by(fresh, 'loot-after-kill').status).toBe('idle');
    const stale = evaluateLiveLoot({ ...base, kills: [{ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - 8 * min }] }, [], officers, config);
    expect(by(stale, 'loot-after-kill').status).toBe('warn');
    expect(by(stale, 'loot-after-kill').detail).toContain('no officer');
  });

  it('an unreachable live store fails the proxy check and says so instead of guessing', () => {
    const h = evaluateLiveLoot({ ...base, kills: [{ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - 8 * min }] }, null, officers, config);
    expect(by(h, 'proxy').status).toBe('fail');
    expect(by(h, 'loot-after-kill').status).toBe('idle');
    expect(by(h, 'discord').status).toBe('idle');
    expect(h.overall).toBe('fail');
  });

  it('wins stuck unconfirmed and confirmed wins never posted are flagged', () => {
    const stuck: StoreRecordView = { time: sec(30 * min), source: 'live', boss: null, difficulty: null };
    const unposted: StoreRecordView = { time: sec(20 * min), boss: "Ula'tek", difficulty: 'Heroic' };
    const h = evaluateLiveLoot(base, [stuck, unposted], officers, config);
    expect(by(h, 'verified').status).toBe('warn');
    expect(by(h, 'discord').status).toBe('warn');
  });

  it('old placeholders (more than 6h) are history, not a live problem', () => {
    const ancient: StoreRecordView = { time: sec(10 * 60 * min), source: 'chat-tail' };
    expect(by(evaluateLiveLoot(base, [ancient], officers, config), 'verified').status).toBe('ok');
  });

  it('missing channel fails; auto-post off only warns; no config leaves both checks out', () => {
    const h = evaluateLiveLoot(base, [], officers, { autoPostLoot: false, channelId: '' });
    expect(by(h, 'channel').status).toBe('fail');
    expect(by(h, 'auto-post').status).toBe('warn');
    expect(evaluateLiveLoot(base, [], officers, null).checks.some((c) => c.id === 'channel')).toBe(false);
  });

  it('the update advice for an outdated real addon points at the normal app, not this Test app', () => {
    const h = evaluateLiveLoot({ ...base, addon: { bundled: '1.1.5', installed: '1.0.0', status: 'outdated' } }, [], officers, config);
    expect(by(h, 'addon').status).toBe('warn');
    expect(by(h, 'addon').detail).toContain('normal Guild Tools app');
  });
});
