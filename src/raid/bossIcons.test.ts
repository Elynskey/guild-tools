import { describe, expect, it } from 'vitest';
import { TIER_BOSS_NAMES, bossIconUrl } from './bossIcons';

describe('boss icons for this tier', () => {
  it("includes The Unbinding of Kith'ix's boss with a render URL", () => {
    expect(TIER_BOSS_NAMES).toContain("Kith'ix");
    expect(bossIconUrl("Kith'ix")).toBe('https://render.worldofwarcraft.com/us/npcs/zoom/creature-display-145178.jpg');
  });
  it('still lists every boss of the earlier raids (8 Abyss + Nymrissa) alongside it', () => {
    expect(TIER_BOSS_NAMES).toHaveLength(10);
    expect(TIER_BOSS_NAMES).toEqual(expect.arrayContaining(['Nymrissa Wavecaller', "Ula'tek", 'Sszorak']));
  });
  it('returns null for a boss that is not in the reference', () => {
    expect(bossIconUrl('Nobody')).toBeNull();
  });
});
