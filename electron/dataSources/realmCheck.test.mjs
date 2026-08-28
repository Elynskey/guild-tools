import { describe, expect, it } from 'vitest';
import { findRealmMismatches } from './realmCheck.cjs';

describe('findRealmMismatches', () => {
  it('flags a character whose wowaudit realm was never observed in the combat log', () => {
    const roster = [{ name: 'Dunbarke', realm: 'Area 52' }];
    const observed = { Dunbarke: ['Scarlet Crusade'] };
    const result = findRealmMismatches(roster, observed);
    expect(result).toEqual([{ name: 'Dunbarke', wowauditRealm: 'Area 52', observedRealms: ['Scarlet Crusade'] }]);
  });

  it('does not flag a matching realm', () => {
    const roster = [{ name: 'Thornwick', realm: 'The Scryers' }];
    const observed = { Thornwick: ['The Scryers'] };
    expect(findRealmMismatches(roster, observed)).toEqual([]);
  });

  it('normalizes case, apostrophes, and spacing before comparing', () => {
    const roster = [{ name: 'Perseffonee', realm: 'Bleeding Hollow' }];
    const observed = { Perseffonee: ['bleeding-hollow'] };
    expect(findRealmMismatches(roster, observed)).toEqual([]);
  });

  it('matches if any one of several observed realms agrees (connected realms / realm changes mid-tier)', () => {
    const roster = [{ name: 'Goku', realm: 'Area 52' }];
    const observed = { Goku: ['Illidan', 'Area 52'] };
    expect(findRealmMismatches(roster, observed)).toEqual([]);
  });

  it('skips characters with no raid log presence this tier', () => {
    const roster = [{ name: 'NewRecruit', realm: 'Area 52' }];
    expect(findRealmMismatches(roster, {})).toEqual([]);
  });

  it('only flags the mismatched character in a mixed roster', () => {
    const roster = [
      { name: 'Dunbarke', realm: 'Area 52' },
      { name: 'Thornwick', realm: 'The Scryers' },
    ];
    const observed = { Dunbarke: ['Scarlet Crusade'], Thornwick: ['The Scryers'] };
    expect(findRealmMismatches(roster, observed)).toEqual([{ name: 'Dunbarke', wowauditRealm: 'Area 52', observedRealms: ['Scarlet Crusade'] }]);
  });
});
