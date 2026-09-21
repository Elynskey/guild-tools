import { describe, expect, it } from 'vitest';
import { buildCaptureView } from './captureStatus';
import type { HeartbeatRow, StoredLootRecord } from './api';

const NOW = 1_800_000_000_000;
const ago = (ms: number) => Math.floor((NOW - ms) / 1000);
const MIN = 60_000;
const win = (over: Partial<StoredLootRecord> = {}): StoredLootRecord => ({ itemId: 1, itemLink: '[Thing]', winner: 'Odasa', boss: "Ula'tek", time: ago(30 * MIN), difficulty: 'Heroic', discordPostedAt: '2026-01-01T00:00:00Z', ...over });
const beat = (over: Partial<HeartbeatRow> = {}): HeartbeatRow => ({ officerName: 'Quixhea#1204', chatLogActive: true, lastSeenAt: NOW - 5000, ...over });

describe('buildCaptureView', () => {
  it('officers are listed with the ones whose logging is on first, and the battle tag stripped', () => {
    const v = buildCaptureView([], [beat({ officerName: 'Zed#1', chatLogActive: false }), beat({ officerName: 'Quixhea#1204' }), beat({ officerName: 'Ann#9' })], NOW);
    expect(v.officers.map((o) => o.name)).toEqual(['Ann', 'Quixhea', 'Zed']);
    expect(v.loggingCount).toBe(2);
    expect(v.officers[0].seenSecondsAgo).toBe(5);
  });

  it('everything confirmed and posted is ok', () => {
    const v = buildCaptureView([win(), win({ winner: 'Beep' })], [beat()], NOW);
    expect(v.headline.tone).toBe('ok');
    expect(v).toMatchObject({ recentWins: 2, postable: 2, posted: 2, overdue: 0, waitingOnAddon: 0 });
  });

  it('a confirmed win not posted after two minutes is flagged, and counted', () => {
    const v = buildCaptureView([win({ discordPostedAt: undefined })], [beat()], NOW);
    expect(v.overdue).toBe(1);
    expect(v.headline).toEqual({ tone: 'watch', text: '1 confirmed win not posted to Discord yet.' });
  });

  it('a win one minute old is not overdue yet', () => {
    expect(buildCaptureView([win({ discordPostedAt: undefined, time: ago(1 * MIN) })], [beat()], NOW).overdue).toBe(0);
  });

  it('wins captured live but not yet confirmed by an addon, older than 10 minutes, are waiting on an addon', () => {
    const v = buildCaptureView([win({ source: 'live', boss: null, difficulty: null, discordPostedAt: undefined, time: ago(30 * MIN) }), win({ source: 'chat-tail', time: ago(2 * MIN) })], [beat()], NOW);
    expect(v.waitingOnAddon).toBe(1);
    expect(v.headline.text).toContain('waiting for an officer');
  });

  it('placeholders are never counted as postable', () => {
    expect(buildCaptureView([win({ source: 'live' })], [beat()], NOW).postable).toBe(0);
  });

  it('only the last 6 hours count, but the newest win is reported whenever it was', () => {
    const v = buildCaptureView([win({ time: ago(3 * 24 * 60 * MIN) })], [beat()], NOW);
    expect(v.recentWins).toBe(0);
    expect(v.newestWinAt).toBe(ago(3 * 24 * 60 * MIN));
    expect(v.headline).toEqual({ tone: 'quiet', text: 'Nothing captured in the last 6 hours.' });
  });

  it('no officer app open and nothing waiting is a quiet note, not an alarm', () => {
    expect(buildCaptureView([], [], NOW).headline).toEqual({ tone: 'quiet', text: "No officer's Guild Tools app is open right now." });
  });

  it('a problem outranks a quiet moment', () => {
    expect(buildCaptureView([win({ discordPostedAt: undefined })], [], NOW).headline.tone).toBe('watch');
  });

  it('an empty store has no newest win', () => {
    expect(buildCaptureView([], [beat()], NOW).newestWinAt).toBeNull();
  });
});
