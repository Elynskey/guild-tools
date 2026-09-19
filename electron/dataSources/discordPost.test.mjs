import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editMessage, postMessage, sendDirectMessage, withSafeMentions } from './discordPost.cjs';

let calls;
beforeEach(() => {
  process.env.DISCORD_BOT_TOKEN = 'test-token';
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ id: 'chan-or-msg' }) };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('mention safety: @everyone and @here never ping', () => {
  it('a normal post allows user and role mentions only (no "everyone")', async () => {
    await postMessage('123', { content: 'Signups are open @everyone and @here' });
    expect(calls[0].body.allowed_mentions).toEqual({ parse: ['users', 'roles'] });
    expect(calls[0].body.allowed_mentions.parse).not.toContain('everyone');
    expect(calls[0].body.content).toBe('Signups are open @everyone and @here'); // text is untouched
  });

  it('an edit is protected the same way', async () => {
    await editMessage('123', '456', { content: 'edited @everyone' });
    expect(calls[0].body.allowed_mentions).toEqual({ parse: ['users', 'roles'] });
  });

  it('a direct message goes through the same protection', async () => {
    await sendDirectMessage('user-1', { content: 'hi @everyone' });
    expect(calls).toHaveLength(2); // open DM channel, then post
    expect(calls[1].body.allowed_mentions).toEqual({ parse: ['users', 'roles'] });
  });

  it('embeds and components are passed through unchanged', async () => {
    const embeds = [{ title: 'Roster', description: 'Devkra, @everyone' }];
    const components = [{ type: 1, components: [] }];
    await postMessage('123', { embeds, components });
    expect(calls[0].body.embeds).toEqual(embeds);
    expect(calls[0].body.components).toEqual(components);
  });

  it('a caller\'s own allowed_mentions is respected, not overwritten', () => {
    expect(withSafeMentions({ content: 'x', allowed_mentions: { parse: [] } }).allowed_mentions).toEqual({ parse: [] });
  });

  it('does not mutate the body it is given', () => {
    const body = { content: 'x' };
    withSafeMentions(body);
    expect(body).toEqual({ content: 'x' });
  });
});
