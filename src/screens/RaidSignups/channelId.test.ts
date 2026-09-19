import { describe, expect, it } from 'vitest';
import { channelIdError } from './channelId';

describe('channelIdError', () => {
  it('accepts blank (use the Settings default) and a real channel ID, with stray spaces', () => {
    expect(channelIdError('')).toBeNull();
    expect(channelIdError('   ')).toBeNull();
    expect(channelIdError('1548097091983900712')).toBeNull();
    expect(channelIdError(' 1548097091983900712 ')).toBeNull();
  });

  it('rejects a channel name, a short number, or an ID with junk in it', () => {
    expect(channelIdError('#raid-attendance')).toMatch(/channel ID/);
    expect(channelIdError('12345')).toMatch(/channel ID/);
    expect(channelIdError('1548097091983900712x')).toMatch(/channel ID/);
  });
});
