import { describe, expect, it } from 'vitest';
import type { LootMonitorSnapshot, PipelineEvent } from '../electron';
import { ago, difficultyName, evaluateLootPipeline, type HeartbeatView, type StoreRecordView } from './lootPipelineHealth';

const NOW = 1_800_000_000_000;
const SEC = 1000;
const MIN = 60 * SEC;

const event = (kind: PipelineEvent['kind'], secondsAgo: number, text: string = kind, meta: PipelineEvent['meta'] = null): PipelineEvent => ({ id: Math.random(), at: NOW - secondsAgo * SEC, kind, text, meta });

function snapshot(over: Partial<LootMonitorSnapshot> = {}): LootMonitorSnapshot {
  return {
    now: NOW,
    wow: { configured: 'C:/WoW', resolved: 'C:/WoW', valid: true, characterName: 'Elishaunt', characterSource: 'addon', characterOverride: null },
    addon: { bundled: '1.6-test', installed: '1.6-test', status: 'current' },
    chatLog: { path: 'C:/WoW/Logs/WoWChatLog.txt', exists: true, active: true, lastWriteAt: NOW - 20 * SEC, sizeBytes: 1000 },
    combatLog: { exists: true, active: true, lastKill: null },
    session: { lastPollAt: NOW - 5 * SEC, lastStatus: 'ok', capturedThisSession: 0, lastCaptureAt: null },
    sessionStartedAt: NOW - 60 * MIN,
    kills: [],
    addonData: { status: 'ok', wins: 0, losses: 0, trades: 0, lastWinAt: null, recentWins: [] },
    events: [],
    ...over,
  };
}

const byId = (h: ReturnType<typeof evaluateLootPipeline>, id: string) => h.checks.find((c) => c.id === id)!;
const heartbeatOk: HeartbeatView = { reporting: true, chatLogActive: true };
const rec = (over: Partial<StoreRecordView> = {}): StoreRecordView => ({ time: Math.floor((NOW - 30 * SEC) / 1000), ...over });

describe('helpers', () => {
  it('formats how long ago', () => {
    expect(ago(NOW - 2 * SEC, NOW)).toBe('just now');
    expect(ago(NOW - 40 * SEC, NOW)).toBe('40s ago');
    expect(ago(NOW - 5 * MIN, NOW)).toBe('5m ago');
    expect(ago(NOW - 3 * 60 * MIN, NOW)).toBe('3h ago');
  });
  it('names difficulties, falling back to the id', () => {
    expect(difficultyName(15)).toBe('Heroic');
    expect(difficultyName(208)).toBe('Delves');
    expect(difficultyName(999)).toBe('difficulty 999');
  });
});

describe('a healthy, quiet start (nothing has happened yet)', () => {
  it('setup is green and everything that needs an event is idle, not failing', () => {
    const h = evaluateLootPipeline(snapshot(), [], heartbeatOk);
    for (const id of ['wow', 'character', 'addon', 'chatlog', 'combatlog']) expect(byId(h, id).status).toBe('ok');
    for (const id of ['boss-kill', 'loot-after-kill', 'live-capture', 'attribution', 'discord']) expect(byId(h, id).status).toBe('idle');
    expect(h.overall).toBe('ok');
  });
});

describe('setup problems', () => {
  it('no WoW folder fails; no chat log fails; a quiet chat log only warns', () => {
    expect(byId(evaluateLootPipeline(snapshot({ wow: { ...snapshot().wow, valid: false, resolved: null } }), [], null), 'wow').status).toBe('fail');
    expect(byId(evaluateLootPipeline(snapshot({ chatLog: { path: null, exists: false, active: false, lastWriteAt: null, sizeBytes: null } }), [], null), 'chatlog').status).toBe('fail');
    const quiet = evaluateLootPipeline(snapshot({ chatLog: { path: 'x', exists: true, active: false, lastWriteAt: NOW - 12 * MIN, sizeBytes: 1 } }), [], null);
    expect(byId(quiet, 'chatlog').status).toBe('warn');
    expect(byId(quiet, 'chatlog').detail).toContain('12m ago');
  });

  it('an outdated addon warns and a missing one fails', () => {
    expect(byId(evaluateLootPipeline(snapshot({ addon: { bundled: '1.7', installed: '1.6', status: 'outdated' } }), [], null), 'addon').status).toBe('warn');
    expect(byId(evaluateLootPipeline(snapshot({ addon: { bundled: '1.7', installed: null, status: 'not_installed' } }), [], null), 'addon').status).toBe('fail');
  });

  it('no combat log only warns (wins still arrive, just unattributed until a reload)', () => {
    expect(byId(evaluateLootPipeline(snapshot({ combatLog: { exists: false, active: false, lastKill: null } }), [], null), 'combatlog').status).toBe('warn');
  });
});

describe('a boss kill and the loot that follows', () => {
  const kill = (secondsAgo: number) => ({ boss: "Ula'tek", difficultyId: 15, endedAt: NOW - secondsAgo * SEC });

  it('a fresh kill is seen and the loot check waits instead of warning', () => {
    const h = evaluateLootPipeline(snapshot({ kills: [kill(30)] }), [], heartbeatOk);
    expect(byId(h, 'boss-kill').status).toBe('ok');
    expect(byId(h, 'boss-kill').detail).toContain("Ula'tek (Heroic)");
    expect(byId(h, 'loot-after-kill').status).toBe('idle');
  });

  it('a kill with no Need win for over 3 minutes warns that the chat log may not be recording loot', () => {
    const h = evaluateLootPipeline(snapshot({ kills: [kill(5 * 60)] }), [], heartbeatOk);
    expect(byId(h, 'loot-after-kill').status).toBe('warn');
  });

  it('a Need win in the chat log after the kill passes the loot check', () => {
    const h = evaluateLootPipeline(snapshot({ kills: [kill(5 * 60)], events: [event('chat-win', 4 * 60)] }), [], heartbeatOk);
    expect(byId(h, 'loot-after-kill').status).toBe('ok');
  });

  it('a win from BEFORE the kill does not count as loot from it', () => {
    const h = evaluateLootPipeline(snapshot({ kills: [kill(5 * 60)], events: [event('chat-win', 20 * 60)] }), [], heartbeatOk);
    expect(byId(h, 'loot-after-kill').status).toBe('warn');
  });
});

describe('attribution', () => {
  it('reports the last win as attributed or left unattributed', () => {
    const attributed = evaluateLootPipeline(snapshot({ events: [event('enrich', 10, "Attributed live: X -> Boss (Heroic)", { attributed: true })] }), [], null);
    expect(byId(attributed, 'attribution').status).toBe('ok');
    const left = evaluateLootPipeline(snapshot({ events: [event('enrich', 10, "Left unattributed: X's win", { attributed: false })] }), [], null);
    expect(byId(left, 'attribution').status).toBe('warn');
  });
});

describe('the hand-offs: chat log -> addon -> store', () => {
  const winsSeen = (n: number) => Array.from({ length: n }, (_, i) => event('chat-win', 200 - i));

  it('wins seen in the chat log but missing from the store is a FAIL (the push is broken)', () => {
    const h = evaluateLootPipeline(snapshot({ events: winsSeen(3), session: { lastPollAt: NOW, lastStatus: 'ok', capturedThisSession: 3, lastCaptureAt: NOW - 100 * SEC } }), [rec()], heartbeatOk);
    expect(byId(h, 'store').status).toBe('fail');
    expect(byId(h, 'store').detail).toContain('3 win(s)');
  });

  it('every win in the store passes', () => {
    const h = evaluateLootPipeline(snapshot({ events: winsSeen(2) }), [rec(), rec()], heartbeatOk);
    expect(byId(h, 'store').status).toBe('ok');
  });

  it('an unreadable store warns rather than failing', () => {
    expect(byId(evaluateLootPipeline(snapshot({ events: winsSeen(1) }), null, heartbeatOk), 'store').status).toBe('warn');
  });

  it('the addon has fewer wins saved than the chat log saw -> warn, and it says to /reload', () => {
    const h = evaluateLootPipeline(snapshot({ events: winsSeen(3) }), [rec(), rec(), rec()], heartbeatOk);
    expect(byId(h, 'addon-data').status).toBe('warn');
    expect(byId(h, 'addon-data').detail).toContain('/reload');
  });

  it('the addon caught up -> ok', () => {
    const recent = Array.from({ length: 3 }, () => ({ winner: 'X', itemLink: '[I]', boss: 'B', zone: 'Z', contentType: 'raid', difficulty: 'Heroic', time: Math.floor((NOW - 100 * SEC) / 1000) }));
    const h = evaluateLootPipeline(snapshot({ events: winsSeen(3), addonData: { status: 'ok', wins: 3, losses: 0, trades: 0, lastWinAt: recent[0].time, recentWins: recent } }), [rec(), rec(), rec()], heartbeatOk);
    expect(byId(h, 'addon-data').status).toBe('ok');
  });

  it('an unconfirmed (chat-tail) win older than 10 minutes warns that it is waiting on the addon', () => {
    const old = rec({ source: 'chat-tail', time: Math.floor((NOW - 15 * MIN) / 1000) });
    expect(byId(evaluateLootPipeline(snapshot(), [old], heartbeatOk), 'verified').status).toBe('warn');
    const fresh = rec({ source: 'chat-tail' });
    expect(byId(evaluateLootPipeline(snapshot(), [fresh], heartbeatOk), 'verified').status).toBe('ok');
  });
});

describe('Discord output', () => {
  it('a confirmed win with a boss and difficulty that is not posted after 2 minutes warns', () => {
    const r = rec({ boss: "Ula'tek", difficulty: 'Heroic', time: Math.floor((NOW - 5 * MIN) / 1000) });
    expect(byId(evaluateLootPipeline(snapshot(), [r], heartbeatOk), 'discord').status).toBe('warn');
  });
  it('once posted it is ok', () => {
    const r = rec({ boss: "Ula'tek", difficulty: 'Heroic', time: Math.floor((NOW - 5 * MIN) / 1000), discordPostedAt: '2026-09-20T02:00:00Z' });
    const h = evaluateLootPipeline(snapshot(), [r], heartbeatOk);
    expect(byId(h, 'discord').status).toBe('ok');
    expect(byId(h, 'discord').detail).toContain('1 of 1');
  });
  it('unconfirmed placeholders and wins with no boss are not expected to be posted (idle, not a warning)', () => {
    expect(byId(evaluateLootPipeline(snapshot(), [rec({ source: 'chat-tail' }), rec({ boss: null, difficulty: null })], heartbeatOk), 'discord').status).toBe('idle');
  });
});

describe('heartbeat and the overall verdict', () => {
  it('this PC missing from the proxy list warns; reporting with a quiet log warns; reporting and active is ok', () => {
    expect(byId(evaluateLootPipeline(snapshot(), [], { reporting: false, chatLogActive: false }), 'heartbeat').status).toBe('warn');
    expect(byId(evaluateLootPipeline(snapshot(), [], { reporting: true, chatLogActive: false }), 'heartbeat').status).toBe('warn');
    expect(byId(evaluateLootPipeline(snapshot(), [], heartbeatOk), 'heartbeat').status).toBe('ok');
  });

  it('overall is the worst status; idle-only is idle', () => {
    expect(evaluateLootPipeline(snapshot({ wow: { ...snapshot().wow, valid: false, resolved: null } }), [], heartbeatOk).overall).toBe('fail');
    expect(evaluateLootPipeline(snapshot({ chatLog: { path: 'x', exists: true, active: false, lastWriteAt: NOW - 20 * MIN, sizeBytes: 1 } }), [], heartbeatOk).overall).toBe('warn');
    const allIdle = evaluateLootPipeline(snapshot({ wow: { ...snapshot().wow, valid: true }, addon: { bundled: null, installed: null, status: 'current' } }), [], null);
    expect(['ok', 'idle']).toContain(allIdle.overall);
  });
});
