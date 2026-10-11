import { describe, expect, it, vi } from 'vitest';
import { createWatcher, newlyPosted, statusLua, describe as describePosted } from './discordPostWatch.cjs';

const NOW = Date.parse('2026-10-10T20:00:00Z');
const rec = (over = {}) => ({ id: 'a', winner: 'Odasa', boss: 'Nymrissa Wavecaller', itemLink: '|cnIQ4:|Hitem:1::::|h[Wavecaller\'s Seastone]|h|r', discordPostedAt: '2026-10-10T19:59:00Z', ...over });

describe('newlyPosted', () => {
  it('returns recently posted wins once, and never twice', () => {
    const seen = new Set();
    expect(newlyPosted([rec()], seen, NOW)).toHaveLength(1);
    expect(newlyPosted([rec()], seen, NOW)).toHaveLength(0);
  });
  it('ignores wins that are not posted, and old stamps', () => {
    const seen = new Set();
    expect(newlyPosted([rec({ discordPostedAt: undefined }), rec({ id: 'b', discordPostedAt: '2026-10-09T19:00:00Z' })], seen, NOW)).toHaveLength(0);
  });
});

describe('messages', () => {
  it('names the boss and the winners, with no WoW colour escapes', () => {
    const { title, body } = describePosted([rec(), rec({ id: 'b', winner: 'Jes|marie', itemLink: '[Alluring Bubbleband]' })]);
    expect(title).toBe('Posted 2 wins to Discord (Nymrissa Wavecaller)');
    expect(body).toContain("Odasa won Wavecaller's Seastone");
    expect(body).not.toContain('|');
  });
  it('writes a Lua file the addon can load (escaped, one table)', () => {
    const lua = statusLua([rec({ winner: 'Say "hi"\\' })], 1_800_000_000);
    expect(lua).toContain('GuildToolsLootStatus = {');
    expect(lua).toContain('postedAt = 1800000000,');
    expect(lua).toContain('count = 1,');
    expect(lua).toContain('Say \\"hi\\"\\\\');
  });
});

describe('createWatcher', () => {
  it('stays quiet on the first look (history), then announces new posts once with both outputs', async () => {
    let records = [rec({ id: 'old' })];
    const notify = vi.fn();
    const writeStatus = vi.fn();
    const w = createWatcher({ getRecords: async () => records, notify, writeStatus, now: () => NOW });
    expect(await w.poll()).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    records = [rec({ id: 'old' }), rec({ id: 'new' })];
    expect(await w.poll()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(writeStatus).toHaveBeenCalledTimes(1);
    expect(await w.poll()).toHaveLength(0);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('a failing notification does not stop the status file', async () => {
    let records = [];
    const writeStatus = vi.fn();
    const w = createWatcher({ getRecords: async () => records, notify: () => { throw new Error('no tray'); }, writeStatus, now: () => NOW });
    await w.poll();
    records = [rec()];
    await w.poll();
    expect(writeStatus).toHaveBeenCalledTimes(1);
  });
});
