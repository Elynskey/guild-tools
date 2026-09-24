import { describe, expect, it } from 'vitest';
import type { MythicPlusRun, Role } from '../../scoring/types';
import { buildComps, findGuildGroups, isTimingGroup, keyRoles, pairRecords, type CompMember } from './mplusComp';

function run(id: number, level: number, upgrades: number, day = 1): MythicPlusRun {
  return {
    dungeon: 'Murder Row',
    level,
    upgrades,
    completedAt: `2026-09-${String(day).padStart(2, '0')}T20:00:00.000Z`,
    score: level * 30,
    iconUrl: '',
    url: `https://raider.io/mythic-plus-runs/season-mn-2/${id}-${level}-murder-row`,
  };
}

/** `role` is their main key role; `alsoKeysAs` are roles they've played in fewer keys. */
function member(name: string, role: Role, rio: number, runs: MythicPlusRun[] = [], alsoKeysAs: Role[] = []): CompMember {
  const roles = [role, ...alsoKeysAs].map((r, i) => ({ role: r, spec: `${r}-spec`, keys: 10 - i }));
  return { name, class: 'Mage', roles, rio, runs };
}

describe('findGuildGroups', () => {
  it('groups raiders by the keys they shared and counts timed vs depleted', () => {
    const a = member('Alpha', 'tank', 3000, [run(1, 12, 1, 3), run(2, 13, 0, 2), run(9, 10, 1)]);
    const b = member('Bravo', 'dps', 2800, [run(1, 12, 1, 3), run(2, 13, 0, 2)]);
    const c = member('Charlie', 'healer', 2700, [run(3, 10, 2)]);

    const groups = findGuildGroups([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual(['Alpha', 'Bravo']);
    expect(groups[0].runs.map((r) => r.level)).toEqual([12, 13]);
    expect(groups[0].timed).toBe(1);
    expect(groups[0].bestTimed).toBe(12);
    expect(isTimingGroup(groups[0])).toBe(true);
  });

  it('records who played what in each shared key, tank and healer first', () => {
    const shared = run(1, 12, 1);
    const groups = findGuildGroups([
      member('Zed', 'dps', 1, [{ ...shared, role: 'dps', spec: 'Havoc' }]),
      member('Ann', 'dps', 1, [{ ...shared, role: 'tank', spec: 'Protection' }]),
    ]);
    expect(groups[0].runs[0].lineup).toEqual([
      { name: 'Ann', role: 'tank', spec: 'Protection' },
      { name: 'Zed', role: 'dps', spec: 'Havoc' },
    ]);
  });

  it('keeps a trio separate from the pair inside it', () => {
    const shared = run(1, 11, 0);
    const groups = findGuildGroups([
      member('A', 'dps', 1, [shared, run(2, 10, 1)]),
      member('B', 'dps', 1, [shared, run(2, 10, 1)]),
      member('C', 'dps', 1, [shared]),
    ]);
    expect(groups.map((g) => g.members.join(','))).toEqual(expect.arrayContaining(['A,B,C', 'A,B']));
    expect(groups.find((g) => g.members.length === 3)!.timed).toBe(0);
    // The pair's record includes the key they ran with C in it.
    expect(pairRecords(groups).get('A|B')).toEqual({ runs: 2, timed: 1 });
  });

  it('skips runs with no URL, which cannot be matched', () => {
    const noUrl = { ...run(1, 10, 1), url: '' };
    expect(findGuildGroups([member('A', 'dps', 1, [noUrl]), member('B', 'dps', 1, [noUrl])])).toEqual([]);
  });
});

describe('buildComps', () => {
  it('builds one tank, one healer and three DPS per group, and benches the rest', () => {
    const roster = [
      member('T1', 'tank', 3000),
      member('T2', 'tank', 2000),
      member('H1', 'healer', 2900),
      member('D1', 'dps', 2800),
      member('D2', 'dps', 2700),
      member('D3', 'dps', 2600),
      member('D4', 'dps', 2500),
    ];
    const { comps, bench } = buildComps(roster, []);
    expect(comps).toHaveLength(1);
    expect(comps[0].tank.member.name).toBe('T1');
    expect(comps[0].dps.map((d) => d.member.name)).toEqual(['D1', 'D2', 'D3']);
    expect(bench.map((m) => m.name)).toEqual(['D4', 'T2']);
  });

  it('prefers a slightly lower score that has timed keys with the group over one that keeps depleting', () => {
    const timedTogether = [1, 2, 3, 4].map((i) => run(i, 12, 1));
    const depletedTogether = [5, 6, 7, 8].map((i) => run(i, 12, 0));
    const roster = [
      member('Tank', 'tank', 3000, [...timedTogether, ...depletedTogether]),
      member('Healer', 'healer', 3000),
      member('Keeper', 'dps', 2500, timedTogether),
      member('Depleter', 'dps', 2600, depletedTogether),
      member('D1', 'dps', 2900),
      member('D2', 'dps', 2900),
    ];
    const { comps, bench } = buildComps(roster, findGuildGroups(roster));
    expect(comps[0].dps.map((d) => d.member.name)).toContain('Keeper');
    expect(bench.map((m) => m.name)).toEqual(['Depleter']);
    expect(comps[0].history[0]).toMatchObject({ a: 'Tank', b: 'Keeper', runs: 4, timed: 4 });
  });

  it('aims each group at the median of its members\' best timed key', () => {
    const roster = [
      member('T', 'tank', 1, [run(1, 14, 1)]),
      member('H', 'healer', 1, [run(2, 10, 1)]),
      member('D1', 'dps', 1, [run(3, 12, 1)]),
      member('D2', 'dps', 1, [run(4, 20, 0)]),
      member('D3', 'dps', 1),
    ];
    expect(buildComps(roster, []).comps[0].targetLevel).toBe(12);
  });
});

describe('keyRoles', () => {
  const keyed = (role: Role, spec: string) => ({ ...run(1, 10, 1), role, spec });

  it('lists every role played in recent keys, most-played first, not the raid role', () => {
    const runs = [keyed('dps', 'Elemental'), keyed('healer', 'Restoration'), keyed('healer', 'Restoration')];
    expect(keyRoles(runs, { role: 'dps', spec: 'Elemental' })).toEqual([
      { role: 'healer', spec: 'Restoration', keys: 2 },
      { role: 'dps', spec: 'Elemental', keys: 1 },
    ]);
  });

  it('breaks a tie with the most recent key', () => {
    const runs = [keyed('dps', 'Havoc'), keyed('tank', 'Vengeance')];
    expect(keyRoles(runs, { role: 'tank', spec: 'Vengeance' }).map((r) => r.role)).toEqual(['dps', 'tank']);
  });

  it('falls back to the raid role when no run records one', () => {
    expect(keyRoles([run(1, 10, 1)], { role: 'tank', spec: 'Blood' })).toEqual([{ role: 'tank', spec: 'Blood', keys: 0 }]);
  });
});

describe('buildComps with raiders who key more than one role', () => {
  it('puts a DPS who has tanked keys in the tank slot when no main tank is left', () => {
    const roster = [
      member('Tank', 'tank', 3000),
      member('H1', 'healer', 3000),
      member('H2', 'healer', 2900),
      member('Flex', 'dps', 2800, [], ['tank']),
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((n) => member(n, 'dps', 2500)),
    ];
    const { comps } = buildComps(roster, []);
    expect(comps).toHaveLength(2);
    expect(comps[0].tank.member.name).toBe('Tank');
    expect(comps[1].tank).toMatchObject({ member: { name: 'Flex' }, spec: 'tank-spec', offRole: true });
  });

  it('prefers a main-role raider of similar score over an off-role one', () => {
    const roster = [
      member('Tank', 'tank', 3000),
      member('Healer', 'healer', 2700),
      member('FlexHealer', 'dps', 2750, [], ['healer']),
      member('A', 'dps', 2500),
      member('B', 'dps', 2500),
      member('C', 'dps', 2500),
    ];
    const { comps } = buildComps(roster, []);
    expect(comps[0].healer.member.name).toBe('Healer');
    expect(comps[0].dps.map((d) => d.member.name)).toContain('FlexHealer');
  });

  it("doesn't spend the only possible healer on a DPS slot", () => {
    const roster = [
      member('Tank', 'tank', 1000),
      member('StarDps', 'dps', 3000, [], ['healer']),
      member('A', 'dps', 2000),
      member('B', 'dps', 2000),
      member('C', 'dps', 2000),
    ];
    const { comps } = buildComps(roster, []);
    expect(comps).toHaveLength(1);
    expect(comps[0].healer.member.name).toBe('StarDps');
  });
});
