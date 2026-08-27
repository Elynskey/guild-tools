import { describe, expect, it } from 'vitest';
import { buildCoverageTable, findUncoveredRecipes, findNearMax, findStalled, buildRequestSummary, buildDiscordReportLines } from './coverageLogic';
import type { FlatCharacter } from './directoryLogic';
import type { CraftRequest, RecipeCatalogue } from './types';

function char(name: string, days: number, profs: { profession: string; skill: number; recipes?: string[] }[]): FlatCharacter {
  return {
    id: name,
    characterName: name,
    realm: 'The Scryers',
    class: 'Warrior',
    mainName: name,
    isMain: true,
    days,
    siblingCount: 1,
    profs: profs.map((p) => ({ profession: p.profession, skill: p.skill, gather: false, recipes: (p.recipes ?? []).map((n) => ({ name: n, expansion: 'Khaz Algar', profession: p.profession })) })),
  };
}

describe('buildCoverageTable', () => {
  it('classifies Gap (0 maxed), Thin (1-2 maxed), Covered (3+ maxed)', () => {
    const chars = [
      char('A', 0, [{ profession: 'Alchemy', skill: 80 }]),
      char('B', 0, [{ profession: 'Blacksmithing', skill: 100 }]),
      char('C', 0, [{ profession: 'Blacksmithing', skill: 100 }]),
      char('D', 0, [{ profession: 'Enchanting', skill: 100 }]),
      char('E', 0, [{ profession: 'Enchanting', skill: 100 }]),
      char('F', 0, [{ profession: 'Enchanting', skill: 100 }]),
    ];
    const table = buildCoverageTable(chars);
    expect(table.find((r) => r.profession === 'Alchemy')?.state).toBe('Gap');
    expect(table.find((r) => r.profession === 'Blacksmithing')?.state).toBe('Thin');
    expect(table.find((r) => r.profession === 'Enchanting')?.state).toBe('Covered');
  });

  it('reports the top crafter by skill', () => {
    const chars = [char('Low', 0, [{ profession: 'Alchemy', skill: 40 }]), char('High', 0, [{ profession: 'Alchemy', skill: 95 }])];
    const row = buildCoverageTable(chars).find((r) => r.profession === 'Alchemy')!;
    expect(row.topCrafterName).toBe('High');
    expect(row.topCrafterSkill).toBe(95);
  });

  it('a profession nobody has shows 0 holders and Gap, not a crash', () => {
    const row = buildCoverageTable([]).find((r) => r.profession === 'Jewelcrafting')!;
    expect(row.holders).toBe(0);
    expect(row.state).toBe('Gap');
    expect(row.topCrafterName).toBeNull();
  });
});

describe('findUncoveredRecipes', () => {
  const catalogue: RecipeCatalogue = { Alchemy: { 'Khaz Algar': ['Flask A', 'Flask B', 'Flask C'] } };

  it('lists catalogue recipes nobody knows', () => {
    const chars = [char('A', 0, [{ profession: 'Alchemy', skill: 50, recipes: ['Flask A'] }])];
    const gaps = findUncoveredRecipes(chars, catalogue, 'Khaz Algar').map((g) => g.name);
    expect(gaps).toEqual(['Flask B', 'Flask C']);
  });

  it('full coverage returns an empty list', () => {
    const chars = [char('A', 0, [{ profession: 'Alchemy', skill: 50, recipes: ['Flask A', 'Flask B', 'Flask C'] }])];
    expect(findUncoveredRecipes(chars, catalogue, 'Khaz Algar')).toEqual([]);
  });

  it('an expansion with no catalogue entry yields no gaps rather than throwing', () => {
    expect(() => findUncoveredRecipes([], catalogue, 'Classic')).not.toThrow();
    expect(findUncoveredRecipes([], catalogue, 'Classic')).toEqual([]);
  });
});

describe('findNearMax / findStalled', () => {
  it('near-max is skill 90-99 descending, excludes maxed (100) and lower skill', () => {
    const chars = [
      char('A', 0, [{ profession: 'Alchemy', skill: 100 }]), // maxed, excluded
      char('B', 0, [{ profession: 'Alchemy', skill: 95 }]),
      char('C', 0, [{ profession: 'Alchemy', skill: 91 }]),
      char('D', 0, [{ profession: 'Alchemy', skill: 80 }]), // too low, excluded
    ];
    expect(findNearMax(chars).map((f) => f.characterName)).toEqual(['B', 'C']);
  });

  it('stalled requires BOTH low skill and 14+ quiet days', () => {
    const chars = [
      char('QuietLow', 20, [{ profession: 'Alchemy', skill: 30 }]), // stalled
      char('RecentLow', 2, [{ profession: 'Alchemy', skill: 30 }]), // active, not stalled
      char('QuietHigh', 20, [{ profession: 'Alchemy', skill: 90 }]), // skilled, not stalled
    ];
    expect(findStalled(chars).map((f) => f.characterName)).toEqual(['QuietLow']);
  });

  it('stalled sorts ascending by skill (worst first)', () => {
    const chars = [
      char('A', 20, [{ profession: 'Alchemy', skill: 40 }]),
      char('B', 20, [{ profession: 'Blacksmithing', skill: 10 }]),
    ];
    expect(findStalled(chars).map((f) => f.characterName)).toEqual(['B', 'A']);
  });
});

describe('buildRequestSummary', () => {
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const requests: CraftRequest[] = [
    { id: '1', requester: 'A', profession: 'Alchemy', description: 'x', createdAt: iso(5), fulfilled: false },
    { id: '2', requester: 'B', profession: 'Alchemy', description: 'y', createdAt: iso(1), fulfilled: false },
    { id: '3', requester: 'C', profession: 'Tailoring', description: 'z', createdAt: iso(10), fulfilled: true },
  ];

  it('splits open vs fulfilled and finds the oldest open request in days', () => {
    const summary = buildRequestSummary(requests);
    expect(summary.open).toBe(2);
    expect(summary.fulfilled).toBe(1);
    expect(summary.oldestOpenDays).toBe(5);
  });

  it('demand is sorted by count descending, share relative to the busiest profession', () => {
    const summary = buildRequestSummary(requests);
    expect(summary.byProfessionDemand[0]).toMatchObject({ profession: 'Alchemy', count: 2, sharePercent: 100 });
    expect(summary.byProfessionDemand[1]).toMatchObject({ profession: 'Tailoring', count: 1, sharePercent: 50 });
  });

  it('an empty request list does not throw', () => {
    expect(buildRequestSummary([])).toMatchObject({ open: 0, fulfilled: 0, oldestOpenDays: 0, byProfessionDemand: [] });
  });
});

describe('buildDiscordReportLines', () => {
  it('flags a Gap profession with the GAP marker and lists uncovered recipes', () => {
    const coverage = buildCoverageTable([char('A', 0, [{ profession: 'Alchemy', skill: 50 }])]);
    const lines = buildDiscordReportLines(coverage, [{ name: 'Flask A', profession: 'Alchemy' }], 3, 'Khaz Algar');
    expect(lines[0]).toBe('**CRD professions — Khaz Algar**');
    expect(lines.some((l) => l.includes('Alchemy: 1 have it, 0 maxed  <-- GAP'))).toBe(true);
    expect(lines).toContain('Uncovered recipes: Flask A');
    expect(lines).toContain('Open crafting requests: 3');
  });

  it('says "none" when there are no uncovered recipes', () => {
    const lines = buildDiscordReportLines([], [], 0, 'Khaz Algar');
    expect(lines).toContain('Uncovered recipes: none');
  });
});
