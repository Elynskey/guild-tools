/**
 * Coverage & Reports — pure port of the design handoff's coverage/gapRecipes/nearMax/
 * stalled/copyReport logic. Same pure-function-over-plain-data approach as directoryLogic.ts.
 */
import { ALL_PROFESSIONS, CRAFTING_PROFESSIONS } from './professionCatalog';
import type { FlatCharacter } from './directoryLogic';
import type { RecipeCatalogue, CraftRequest } from './types';

export type CoverageState = 'Gap' | 'Thin' | 'Covered';

export interface CoverageRow {
  profession: string;
  holders: number;
  maxed: number;
  maxedSharePercent: number; // 0-100, share of holders who are maxed
  topCrafterName: string | null;
  topCrafterSkill: number | null;
  state: CoverageState;
}

const THIN_MAX_CEILING = 2; // 1-2 maxed = Thin; 3+ = Covered; 0 = Gap

export function buildCoverageTable(chars: FlatCharacter[]): CoverageRow[] {
  return ALL_PROFESSIONS.map((profession) => {
    const holders = chars.filter((c) => c.profs.some((p) => p.profession === profession));
    const withSkill = holders.map((c) => ({ character: c, skill: c.profs.find((p) => p.profession === profession)?.skill ?? 0 }));
    const maxed = withSkill.filter((h) => h.skill >= 100);
    const top = withSkill.slice().sort((a, b) => b.skill - a.skill)[0];
    const state: CoverageState = maxed.length === 0 ? 'Gap' : maxed.length <= THIN_MAX_CEILING ? 'Thin' : 'Covered';
    return {
      profession,
      holders: holders.length,
      maxed: maxed.length,
      maxedSharePercent: holders.length ? Math.round((maxed.length / holders.length) * 100) : 0,
      topCrafterName: top ? top.character.characterName : null,
      topCrafterSkill: top ? top.skill : null,
      state,
    };
  });
}

export interface GapRecipe {
  name: string;
  profession: string;
}

/**
 * Recipes that exist (per the catalogue) but nobody in the guild knows, for one concrete
 * expansion — caller resolves "All expansions" down to a specific one first (this report
 * doesn't make sense summed across every expansion ever, same as the design's own fallback).
 * Crafting professions only — gathering has no discrete recipe list.
 */
export function findUncoveredRecipes(chars: FlatCharacter[], catalogue: RecipeCatalogue, expansion: string): GapRecipe[] {
  const known = new Set<string>();
  for (const c of chars) for (const p of c.profs) for (const r of p.recipes) known.add(r.name);

  const gaps: GapRecipe[] = [];
  for (const profession of CRAFTING_PROFESSIONS) {
    const catalogueRecipes = catalogue[profession]?.[expansion] ?? [];
    for (const name of catalogueRecipes) if (!known.has(name)) gaps.push({ name, profession });
  }
  return gaps;
}

export interface SkillEntry {
  characterName: string;
  profession: string;
  skill: number;
}

const NEAR_MAX_FLOOR = 90;
const STALLED_SKILL_CEILING = 65;
const STALLED_QUIET_DAYS = 14;
const REPORT_CAP = 9;

function flattenSkills(chars: FlatCharacter[]): SkillEntry[] {
  const flat: SkillEntry[] = [];
  for (const c of chars) for (const p of c.profs) flat.push({ characterName: c.characterName, profession: p.profession, skill: p.skill });
  return flat;
}

/** Top N character/profession pairs at skill 90-99, descending — one step from maxed. */
export function findNearMax(chars: FlatCharacter[], cap = REPORT_CAP): SkillEntry[] {
  return flattenSkills(chars)
    .filter((f) => f.skill >= NEAR_MAX_FLOOR && f.skill < 100)
    .sort((a, b) => b.skill - a.skill)
    .slice(0, cap);
}

/** Low skill AND quiet 14+ days, ascending by skill — the officer nudge-worthy list. */
export function findStalled(chars: FlatCharacter[], cap = REPORT_CAP): SkillEntry[] {
  const byName = new Map(chars.map((c) => [c.characterName, c] as const));
  return flattenSkills(chars)
    .filter((f) => f.skill < STALLED_SKILL_CEILING && (byName.get(f.characterName)?.days ?? 0) > STALLED_QUIET_DAYS)
    .sort((a, b) => a.skill - b.skill)
    .slice(0, cap);
}

export interface RequestDemand {
  profession: string;
  count: number;
  sharePercent: number; // relative to the busiest profession, 0-100
}

export interface RequestSummary {
  open: number;
  fulfilled: number;
  oldestOpenDays: number;
  byProfessionDemand: RequestDemand[];
}

export function buildRequestSummary(requests: CraftRequest[]): RequestSummary {
  const open = requests.filter((r) => !r.fulfilled);
  const ageDays = (r: CraftRequest) => Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86_400_000);

  const demand = new Map<string, number>();
  for (const r of requests) demand.set(r.profession, (demand.get(r.profession) ?? 0) + 1);
  const maxDemand = Math.max(1, ...demand.values());
  const byProfessionDemand = [...demand.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([profession, count]): RequestDemand => ({ profession, count, sharePercent: Math.round((count / maxDemand) * 100) }));

  return {
    open: open.length,
    fulfilled: requests.length - open.length,
    oldestOpenDays: open.length ? Math.max(...open.map(ageDays)) : 0,
    byProfessionDemand,
  };
}

/** Plain-text Discord report — one line per profession, gap flag, uncovered-recipe summary, open request count. */
export function buildDiscordReportLines(coverage: CoverageRow[], gapRecipes: GapRecipe[], openRequestCount: number, expansion: string): string[] {
  return [
    `**CRD professions — ${expansion}**`,
    '',
    ...coverage.map((c) => `${c.profession}: ${c.holders} have it, ${c.maxed} maxed${c.maxed ? '' : '  <-- GAP'}`),
    '',
    `Uncovered recipes: ${gapRecipes.length ? gapRecipes.map((g) => g.name).join(', ') : 'none'}`,
    `Open crafting requests: ${openRequestCount}`,
  ];
}
