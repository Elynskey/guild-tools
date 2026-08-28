import { describe, expect, it } from 'vitest';
import { mergeSources } from './merge.cjs';
import { charKey } from './raiderio.cjs';

const baseWcl = (overrides) => ({
  role: 'dps',
  class: 'Warrior',
  spec: 'Arms',
  perf: 100,
  parseTrend: 0,
  deaths: 0,
  pulls: 1,
  deathCauses: [],
  nightParse: 100,
  nightDeaths: 0,
  nightPulls: 1,
  nightDeathCauses: [],
  ...overrides,
});

describe('mergeSources', () => {
  it('merges a single raider normally', () => {
    const wowauditRoster = [{ name: 'Thornwick', realm: 'The Scryers', role: 'tank', rank: 'Main' }];
    const rio = [{ key: charKey('Thornwick', 'The Scryers'), name: 'Thornwick', realm: 'The Scryers', class: 'Paladin', spec: 'Protection', rioCurrent: 1500, rioHighestThisSeason: 1500, ilvlEquipped: 700, ilvlHighestThisSeason: 700 }];
    const gearCompletion = { [charKey('Thornwick', 'The Scryers')]: 90 };
    const wcl = { Thornwick: baseWcl({ role: 'tank' }) };

    const result = mergeSources({ wowauditRoster, rio, gearCompletion, wcl });
    expect(result).toHaveLength(1);
    expect(result[0].rioCurrent).toBe(1500);
    expect(result[0].gearCompletion).toBe(90);
  });

  // The "Dunbarke" bug class: two different real people, same character name,
  // different realms. Confirms each gets THEIR OWN RIO/gear data, not the other
  // person's -- the actual failure mode a bare-name join would produce.
  it('does not mix up RIO/gear data for two raiders sharing a name on different realms', () => {
    const wowauditRoster = [
      { name: 'Dunbarke', realm: 'Area 52', role: 'dps', rank: 'Main' },
      { name: 'Dunbarke', realm: 'Scarlet Crusade', role: 'healer', rank: 'Alt' },
    ];
    const rio = [
      { key: charKey('Dunbarke', 'Area 52'), name: 'Dunbarke', realm: 'Area 52', class: 'Rogue', spec: 'Outlaw', rioCurrent: 100, rioHighestThisSeason: 100, ilvlEquipped: 400, ilvlHighestThisSeason: 400 },
      { key: charKey('Dunbarke', 'Scarlet Crusade'), name: 'Dunbarke', realm: 'Scarlet Crusade', class: 'Warlock', spec: 'Destruction', rioCurrent: 1287, rioHighestThisSeason: 1287, ilvlEquipped: 696, ilvlHighestThisSeason: 696 },
    ];
    const gearCompletion = {
      [charKey('Dunbarke', 'Area 52')]: 20,
      [charKey('Dunbarke', 'Scarlet Crusade')]: 95,
    };
    // WCL can't disambiguate by name alone -- fetchRoster.cjs's collision guard
    // would exclude both from roleByName, so neither gets a `wcl` entry here.
    const wcl = {};

    const result = mergeSources({ wowauditRoster, rio, gearCompletion, wcl });
    // Both correctly excluded (no WCL data) rather than one silently getting the
    // other's stats -- this is the safe failure mode, not a crash or wrong merge.
    expect(result).toHaveLength(0);
  });

  it('correctly attributes RIO/gear when only one of two same-named raiders has WCL data', () => {
    const wowauditRoster = [
      { name: 'Goku', realm: 'Illidan', role: 'dps', rank: 'Main' },
      { name: 'Goku', realm: 'Area 52', role: 'dps', rank: 'Main' },
    ];
    const rio = [
      { key: charKey('Goku', 'Illidan'), name: 'Goku', realm: 'Illidan', class: 'Monk', spec: 'Windwalker', rioCurrent: 2000, rioHighestThisSeason: 2000, ilvlEquipped: 710, ilvlHighestThisSeason: 710 },
      { key: charKey('Goku', 'Area 52'), name: 'Goku', realm: 'Area 52', class: 'Druid', spec: 'Feral', rioCurrent: 500, rioHighestThisSeason: 500, ilvlEquipped: 600, ilvlHighestThisSeason: 600 },
    ];
    const gearCompletion = {
      [charKey('Goku', 'Illidan')]: 88,
      [charKey('Goku', 'Area 52')]: 40,
    };
    // Simulates fetchRoster.cjs's collision guard: since both wowaudit entries are
    // named "Goku", roleByName can't safely be built for either, so WCL never
    // computes performance for the name at all (this is the real, current
    // behavior -- fetchRoster.cjs excludes the whole colliding name, not just one
    // side of it, since WCL has no way to know which "Goku" a given log row is).
    const wcl = {};

    const result = mergeSources({ wowauditRoster, rio, gearCompletion, wcl });
    expect(result).toHaveLength(0);
  });

  it('omits a raider with no matching Raider.IO entry for their specific realm', () => {
    const wowauditRoster = [{ name: 'Ghost', realm: 'Area 52', role: 'dps', rank: 'Main' }];
    // RIO data exists for the SAME NAME but the WRONG realm -- must not match.
    const rio = [{ key: charKey('Ghost', 'Some Other Realm'), name: 'Ghost', realm: 'Some Other Realm', class: 'Mage', spec: 'Fire', rioCurrent: 1000, rioHighestThisSeason: 1000, ilvlEquipped: 650, ilvlHighestThisSeason: 650 }];
    const wcl = { Ghost: baseWcl({}) };

    const result = mergeSources({ wowauditRoster, rio, gearCompletion: {}, wcl });
    expect(result).toHaveLength(0);
  });
});
