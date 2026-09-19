import { describe, expect, it } from 'vitest';
import { formatRoleBlock, resolveChannelId } from './signupsStore.cjs';

const CHANNEL_A = '1548097091983900712';
const CHANNEL_B = '1548097079967096932';

describe('resolveChannelId (posting channel is chosen per post)', () => {
  it('uses the channel chosen for this post over the Settings default', () => {
    expect(resolveChannelId(CHANNEL_B, CHANNEL_A)).toBe(CHANNEL_B);
    expect(resolveChannelId(`  ${CHANNEL_B}  `, CHANNEL_A)).toBe(CHANNEL_B);
  });

  it('falls back to the Settings default when the post does not choose one', () => {
    expect(resolveChannelId('', CHANNEL_A)).toBe(CHANNEL_A);
    expect(resolveChannelId('   ', CHANNEL_A)).toBe(CHANNEL_A);
    expect(resolveChannelId(undefined, CHANNEL_A)).toBe(CHANNEL_A);
    expect(resolveChannelId(null, CHANNEL_A)).toBe(CHANNEL_A);
  });

  it('is null (post saved but not sent) when neither the post nor Settings names a channel', () => {
    expect(resolveChannelId('', '')).toBeNull();
    expect(resolveChannelId(undefined, undefined)).toBeNull();
  });

  it('rejects something that is not a channel ID instead of quietly posting to the default', () => {
    expect(() => resolveChannelId('#raid-attendance', CHANNEL_A)).toThrow(/channel ID/);
    expect(() => resolveChannelId('12345', CHANNEL_A)).toThrow(/channel ID/);
    expect(() => resolveChannelId(`${CHANNEL_B}x`, CHANNEL_A)).toThrow(/channel ID/);
  });
});

describe('final roster backup order', () => {
  const entry = (assignments) => ({
    signups: [
      { discordUserId: 'u1', characterName: 'Devkra', class: 'Warrior', specs: ['Arms'] },
      { discordUserId: 'u2', characterName: 'Odasa', class: 'Mage', specs: ['Fire'] },
      { discordUserId: 'u3', characterName: 'Ranikina', class: 'Priest', specs: null },
    ],
    assignments: { tank: [], healer: [], dps: [], ...assignments },
  });

  it('numbers several backups in the order the officer set', () => {
    const block = formatRoleBlock(
      entry({
        dps: [
          { discordUserId: 'u3', tier: 'backup' },
          { discordUserId: 'u1', tier: 'primary' },
          { discordUserId: 'u2', tier: 'backup' },
        ],
      }),
      'dps',
    );
    expect(block).toBe('**DPS**\nPrimary: Devkra (Arms Warrior)\nBackup (call-up order): 1. Ranikina (Priest), 2. Odasa (Fire Mage)');
  });

  it('keeps a single backup, and no backups, in the plain form', () => {
    expect(formatRoleBlock(entry({ dps: [{ discordUserId: 'u2', tier: 'backup' }] }), 'dps')).toBe('**DPS**\nPrimary: —\nBackup: Odasa (Fire Mage)');
    expect(formatRoleBlock(entry({}), 'tank')).toBe('**Tank**\nPrimary: —\nBackup: —');
  });
});
