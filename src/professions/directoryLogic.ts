/**
 * Member directory — pure, framework-free port of the design handoff's
 * `class Component extends DCLogic` (Professions.dc.html): matches()/sort/expRecipes/
 * rowFor/profGroups/detail. Kept pure and testable, same reasoning as src/scoring/scoring.ts —
 * this is the "auditable" filtering/sorting/grouping core, React components just call it and
 * render the result. Presentational tone/color mapping lives in the UI layer, not here
 * (mirrors scoring.ts + bandVisuals.ts's split).
 */
import { ALL_PROFESSIONS } from './professionCatalog';
import { deriveExpansionLabel, pickMostRecentTier } from './expansions';
import type { MemberProfessions } from './types';

export const ALL_EXPANSIONS_FILTER = 'All expansions';

export interface FlatRecipe {
  name: string;
  expansion: string;
  profession: string;
}

export interface FlatProfession {
  profession: string;
  skill: number; // 0-100, from the most recent tier
  gather: boolean;
  recipes: FlatRecipe[]; // every known recipe across every tier, each tagged with its expansion
}

export interface FlatCharacter {
  id: string;
  characterName: string;
  realm: string;
  class: string;
  mainName: string;
  isMain: boolean;
  days: number; // days since last login; 0 = online
  siblingCount: number; // how many characters this main has in total
  profs: FlatProfession[];
}

export type Scope = 'All characters' | 'Mains only' | 'Alts only';
export type SortKey = 'name' | 'prof' | 'skill' | 'recipes' | 'seen';
export type SortDir = 1 | -1;

export interface DirectoryFilters {
  query: string;
  expansion: string; // ALL_EXPANSIONS_FILTER or a real label
  scope: Scope;
  seenWithinDays: number;
  professions: string[]; // selected facet chips (OR within professions)
  recipeFilter: string | null;
}

export const DEFAULT_FILTERS: DirectoryFilters = {
  query: '',
  expansion: ALL_EXPANSIONS_FILTER,
  scope: 'All characters',
  seenWithinDays: 30,
  professions: [],
  recipeFilter: null,
};

/** Flattens the grouped member/character shape into one row per character, with everything the directory needs pre-derived. */
export function flattenCharacters(members: MemberProfessions[]): FlatCharacter[] {
  const flat: FlatCharacter[] = [];
  for (const member of members) {
    for (const c of member.characters) {
      const profs: FlatProfession[] = c.professions.map((entry) => {
        const latestTier = pickMostRecentTier(entry.tiers, entry.profession);
        const skill = latestTier?.maxSkillPoints ? Math.round((latestTier.skillPoints / latestTier.maxSkillPoints) * 100) : 0;
        const recipes: FlatRecipe[] = entry.tiers.flatMap((tier) => {
          const expansion = deriveExpansionLabel(tier.tierName, entry.profession);
          return tier.knownRecipes.map((name) => ({ name, expansion, profession: entry.profession }));
        });
        return { profession: entry.profession, skill, gather: isGathering(entry.profession), recipes };
      });
      flat.push({
        id: `${c.characterName}::${c.realm}`,
        characterName: c.characterName,
        realm: c.realm,
        class: c.class,
        mainName: member.mainName,
        isMain: c.characterName === member.mainName,
        days: c.lastLoginDaysAgo,
        siblingCount: member.characters.length,
        profs,
      });
    }
  }
  return flat;
}

function isGathering(profession: string): boolean {
  return profession === 'Herbalism' || profession === 'Mining' || profession === 'Skinning';
}

/** Every recipe a character knows, scoped to one expansion (or all of them). */
export function expRecipes(c: FlatCharacter, expansion: string): FlatRecipe[] {
  const out: FlatRecipe[] = [];
  for (const p of c.profs) for (const r of p.recipes) if (expansion === ALL_EXPANSIONS_FILTER || r.expansion === expansion) out.push(r);
  return out;
}

export function matchesFilters(c: FlatCharacter, filters: DirectoryFilters): boolean {
  if (filters.scope === 'Mains only' && !c.isMain) return false;
  if (filters.scope === 'Alts only' && c.isMain) return false;
  if (c.days > filters.seenWithinDays) return false;
  if (filters.professions.length && !c.profs.some((p) => filters.professions.includes(p.profession))) return false;
  if (filters.recipeFilter && !c.profs.some((p) => p.recipes.some((r) => r.name === filters.recipeFilter))) return false;
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  if (c.characterName.toLowerCase().includes(q)) return true;
  if (c.mainName.toLowerCase().includes(q)) return true;
  if (c.profs.some((p) => p.profession.toLowerCase().includes(q))) return true;
  return expRecipes(c, filters.expansion).some((r) => r.name.toLowerCase().includes(q));
}

export function filterCharacters(all: FlatCharacter[], filters: DirectoryFilters): FlatCharacter[] {
  return all.filter((c) => matchesFilters(c, filters));
}

function bestSkill(c: FlatCharacter): number {
  return c.profs.reduce((m, p) => Math.max(m, p.skill), 0);
}

export function sortCharacters(chars: FlatCharacter[], key: SortKey, dir: SortDir, expansion: string): FlatCharacter[] {
  const withTiebreak = (v: number, a: FlatCharacter, b: FlatCharacter) => v * dir || a.characterName.localeCompare(b.characterName);
  return [...chars].sort((a, b) => {
    if (key === 'name') return withTiebreak(a.characterName.localeCompare(b.characterName), a, b);
    if (key === 'prof') return withTiebreak((a.profs[0]?.profession ?? 'zzz').localeCompare(b.profs[0]?.profession ?? 'zzz'), a, b);
    if (key === 'skill') return withTiebreak(bestSkill(b) - bestSkill(a), a, b);
    if (key === 'recipes') return withTiebreak(expRecipes(b, expansion).length - expRecipes(a, expansion).length, a, b);
    return withTiebreak(a.days - b.days, a, b); // 'seen'
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { slice: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), pages);
  return { slice: items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize), page: clampedPage, pages };
}

/* ---------- search suggestions ---------- */

export type SuggestionKind = 'character' | 'profession' | 'recipe';

export interface Suggestion {
  kind: SuggestionKind;
  label: string;
  meta: string;
  value: string; // character name / profession name / recipe name
}

export interface SuggestionGroup {
  label: string;
  items: Suggestion[];
}

const SUGGEST_CHAR_CAP = 5;
const SUGGEST_PROF_CAP = 5;
const SUGGEST_RECIPE_CAP = 6;

export function buildSuggestions(all: FlatCharacter[], query: string, expansion: string): SuggestionGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const groups: SuggestionGroup[] = [];

  const charMatches = all
    .filter((c) => c.characterName.toLowerCase().includes(q))
    .slice(0, SUGGEST_CHAR_CAP)
    .map((c): Suggestion => ({ kind: 'character', label: c.characterName, meta: c.isMain ? `${c.siblingCount} characters` : `alt of ${c.mainName}`, value: c.characterName }));
  if (charMatches.length) groups.push({ label: 'Characters', items: charMatches });

  const profMatches = ALL_PROFESSIONS.filter((p) => p.toLowerCase().includes(q))
    .slice(0, SUGGEST_PROF_CAP)
    .map((p): Suggestion => ({ kind: 'profession', label: p, meta: `${all.filter((c) => c.profs.some((x) => x.profession === p)).length} have it`, value: p }));
  if (profMatches.length) groups.push({ label: 'Professions', items: profMatches });

  const recipeCounts = new Map<string, number>();
  for (const c of all) for (const r of expRecipes(c, expansion)) if (r.name.toLowerCase().includes(q)) recipeCounts.set(r.name, (recipeCounts.get(r.name) ?? 0) + 1);
  const recipeMatches = [...recipeCounts.entries()]
    .slice(0, SUGGEST_RECIPE_CAP)
    .map(([name, count]): Suggestion => ({ kind: 'recipe', label: name, meta: `${count} know it`, value: name }));
  if (recipeMatches.length) groups.push({ label: `Recipes · ${expansion}`, items: recipeMatches });

  return groups;
}

/* ---------- recipe pill tone (View A/C detail chips) ---------- */

export type RecipeTone = 'match' | 'current' | 'legacy';

export function recipeTone(recipe: FlatRecipe, query: string, currentExpansion: string): RecipeTone {
  const q = query.trim().toLowerCase();
  if (q && recipe.name.toLowerCase().includes(q)) return 'match';
  return recipe.expansion === currentExpansion ? 'current' : 'legacy';
}

/** Recipes grouped by expansion, for a character's expanded detail view. */
export function groupRecipesByExpansion(recipes: FlatRecipe[]): { expansion: string; recipes: FlatRecipe[] }[] {
  const byExp = new Map<string, FlatRecipe[]>();
  for (const r of recipes) byExp.set(r.expansion, [...(byExp.get(r.expansion) ?? []), r]);
  return [...byExp.entries()].map(([expansion, recipes]) => ({ expansion, recipes }));
}

/* ---------- View B: by profession ---------- */

export interface ProfessionGroupMember {
  character: FlatCharacter;
  skill: number;
}

export interface ProfessionGroup {
  profession: string;
  members: ProfessionGroupMember[]; // sorted by skill desc
  maxedCount: number;
}

export function buildProfessionGroups(chars: FlatCharacter[], selectedProfessions: string[]): ProfessionGroup[] {
  const professions = ALL_PROFESSIONS.filter((p) => !selectedProfessions.length || selectedProfessions.includes(p));
  return professions.map((profession) => {
    const members = chars
      .filter((c) => c.profs.some((p) => p.profession === profession))
      .map((c) => ({ character: c, skill: c.profs.find((p) => p.profession === profession)?.skill ?? 0 }))
      .sort((a, b) => b.skill - a.skill);
    return { profession, members, maxedCount: members.filter((m) => m.skill >= 100).length };
  });
}

/* ---------- View C: roster + detail ---------- */

export interface MainListEntry {
  mainName: string;
  characterCount: number;
  days: number; // main character's days-since-login, for the presence dot
}

/** Distinct mains among the given (typically filtered) character list, in first-seen order. */
export function buildMainsList(chars: FlatCharacter[]): MainListEntry[] {
  const seen = new Map<string, MainListEntry>();
  for (const c of chars) {
    const existing = seen.get(c.mainName);
    if (!existing) {
      seen.set(c.mainName, { mainName: c.mainName, characterCount: c.siblingCount, days: c.isMain ? c.days : 999 });
    } else if (c.isMain) {
      existing.days = c.days;
    }
  }
  return [...seen.values()];
}

/** All characters for one main, from the FULL (unfiltered) list — the detail pane always shows the whole member. */
export function charactersForMain(all: FlatCharacter[], mainName: string): FlatCharacter[] {
  return all.filter((c) => c.mainName === mainName);
}
