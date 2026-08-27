import { describe, expect, it } from 'vitest';
import {
  flattenCharacters,
  matchesFilters,
  filterCharacters,
  sortCharacters,
  paginate,
  buildSuggestions,
  buildProfessionGroups,
  buildMainsList,
  charactersForMain,
  expRecipes,
  recipeTone,
  groupRecipesByExpansion,
  DEFAULT_FILTERS,
  ALL_EXPANSIONS_FILTER,
  type FlatCharacter,
} from './directoryLogic';
import type { MemberProfessions } from './types';

const MEMBERS: MemberProfessions[] = [
  {
    mainName: 'Harima',
    characters: [
      {
        characterName: 'Harima',
        realm: 'The Scryers',
        class: 'Mage',
        lastLoginDaysAgo: 0,
        professions: [
          {
            profession: 'Alchemy',
            tiers: [
              { tierName: 'Khaz Algar Alchemy', skillPoints: 90, maxSkillPoints: 100, knownRecipes: ['Flask of Alchemical Chaos', 'Tempered Potion'] },
              { tierName: 'Dragon Isles Alchemy', skillPoints: 100, maxSkillPoints: 100, knownRecipes: ['Phial of Tepid Versatility'] },
            ],
          },
        ],
      },
      {
        characterName: 'Harimalt',
        realm: 'The Scryers',
        class: 'Priest',
        lastLoginDaysAgo: 5,
        professions: [{ profession: 'Tailoring', tiers: [{ tierName: 'Khaz Algar Tailoring', skillPoints: 40, maxSkillPoints: 100, knownRecipes: [] }] }],
      },
    ],
  },
  {
    mainName: 'Quixxie',
    characters: [
      {
        characterName: 'Quixxie',
        realm: 'The Scryers',
        class: 'Shaman',
        lastLoginDaysAgo: 20,
        professions: [{ profession: 'Alchemy', tiers: [{ tierName: 'Khaz Algar Alchemy', skillPoints: 60, maxSkillPoints: 100, knownRecipes: ['Tempered Potion'] }] }],
      },
    ],
  },
];

const flat = flattenCharacters(MEMBERS);

describe('flattenCharacters', () => {
  it('flattens one row per character, tagging isMain and siblingCount', () => {
    expect(flat).toHaveLength(3);
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    expect(harima.isMain).toBe(true);
    expect(harima.siblingCount).toBe(2);
    const alt = flat.find((c) => c.characterName === 'Harimalt')!;
    expect(alt.isMain).toBe(false);
  });

  it('computes skill from the most recent tier by real chronology, not tiers[0] or highest skillPoints', () => {
    // Khaz Algar (90/100) is chronologically newer than Dragon Isles (100/100) per
    // EXPANSION_ORDER, so it should win even though its skillPoints value is lower.
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    const alchemy = harima.profs.find((p) => p.profession === 'Alchemy')!;
    expect(alchemy.skill).toBe(90);
  });

  it('tags each known recipe with the expansion its tier came from', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    const alchemy = harima.profs.find((p) => p.profession === 'Alchemy')!;
    const flask = alchemy.recipes.find((r) => r.name === 'Flask of Alchemical Chaos');
    expect(flask?.expansion).toBe('Khaz Algar');
    const phial = alchemy.recipes.find((r) => r.name === 'Phial of Tepid Versatility');
    expect(phial?.expansion).toBe('Dragon Isles');
  });
});

describe('expRecipes', () => {
  it('scopes to one expansion', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    expect(expRecipes(harima, 'Khaz Algar').map((r) => r.name)).toEqual(['Flask of Alchemical Chaos', 'Tempered Potion']);
  });

  it('returns everything for "All expansions"', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    expect(expRecipes(harima, ALL_EXPANSIONS_FILTER)).toHaveLength(3);
  });
});

describe('matchesFilters / filterCharacters', () => {
  it('scope filters mains/alts', () => {
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, scope: 'Mains only' }).map((c) => c.characterName).sort()).toEqual(['Harima', 'Quixxie']);
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, scope: 'Alts only' }).map((c) => c.characterName)).toEqual(['Harimalt']);
  });

  it('seenWithinDays excludes characters last seen further back', () => {
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, seenWithinDays: 7 }).map((c) => c.characterName).sort()).toEqual(['Harima', 'Harimalt']);
  });

  it('profession facet filters to characters with any selected profession', () => {
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, professions: ['Tailoring'] }).map((c) => c.characterName)).toEqual(['Harimalt']);
  });

  it('recipeFilter narrows to characters who know that exact recipe', () => {
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, recipeFilter: 'Phial of Tepid Versatility' }).map((c) => c.characterName)).toEqual(['Harima']);
  });

  it('query matches character name, main name, profession name, or a recipe in the selected expansion', () => {
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, query: 'harimalt' }).map((c) => c.characterName)).toEqual(['Harimalt']);
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, query: 'tailoring' }).map((c) => c.characterName)).toEqual(['Harimalt']);
    expect(filterCharacters(flat, { ...DEFAULT_FILTERS, query: 'tempered' }).map((c) => c.characterName).sort()).toEqual(['Harima', 'Quixxie']);
  });

  it('an empty query matches everything (subject to other filters)', () => {
    expect(matchesFilters(flat[0], DEFAULT_FILTERS)).toBe(true);
  });
});

describe('sortCharacters', () => {
  it('sorts by name ascending/descending', () => {
    const asc = sortCharacters(flat, 'name', 1, ALL_EXPANSIONS_FILTER).map((c) => c.characterName);
    expect(asc).toEqual(['Harima', 'Harimalt', 'Quixxie']);
    const desc = sortCharacters(flat, 'name', -1, ALL_EXPANSIONS_FILTER).map((c) => c.characterName);
    expect(desc).toEqual(['Quixxie', 'Harimalt', 'Harima']);
  });

  it('sorts by best skill descending when dir=1', () => {
    const sorted = sortCharacters(flat, 'skill', 1, ALL_EXPANSIONS_FILTER).map((c) => c.characterName);
    expect(sorted[0]).toBe('Harima'); // skill 100
  });

  it('sorts by last-seen (days) ascending when dir=1', () => {
    const sorted = sortCharacters(flat, 'seen', 1, ALL_EXPANSIONS_FILTER).map((c) => c.characterName);
    expect(sorted[0]).toBe('Harima'); // days=0, online
  });
});

describe('paginate', () => {
  it('slices and clamps the page number into range', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 1, 10).slice).toHaveLength(10);
    expect(paginate(items, 3, 10).slice).toHaveLength(5);
    expect(paginate(items, 99, 10).page).toBe(3); // clamped to last page
    expect(paginate(items, 0, 10).page).toBe(1); // clamped to first page
  });

  it('always reports at least 1 page, even for an empty list', () => {
    expect(paginate([], 1, 10).pages).toBe(1);
  });
});

describe('buildSuggestions', () => {
  it('returns nothing for an empty query', () => {
    expect(buildSuggestions(flat, '', 'Khaz Algar')).toEqual([]);
  });

  it('groups matches into Characters / Professions / Recipes', () => {
    const groups = buildSuggestions(flat, 'a', 'Khaz Algar');
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Characters');
    expect(labels).toContain('Professions');
  });

  it('recipe suggestion count reflects how many characters know it', () => {
    const groups = buildSuggestions(flat, 'tempered', 'Khaz Algar');
    const recipeGroup = groups.find((g) => g.label.startsWith('Recipes'));
    expect(recipeGroup?.items[0]).toMatchObject({ label: 'Tempered Potion', meta: '2 know it' });
  });
});

describe('buildProfessionGroups', () => {
  it('one group per tracked profession, members sorted by skill descending', () => {
    const groups = buildProfessionGroups(flat, []);
    const alchemy = groups.find((g) => g.profession === 'Alchemy')!;
    expect(alchemy.members.map((m) => m.character.characterName)).toEqual(['Harima', 'Quixxie']); // Harima's 90 skill beats Quixxie's 60
    expect(alchemy.maxedCount).toBe(0); // nobody's at 100 once skill correctly comes from the most recent (Khaz Algar) tier
  });

  it('respects a profession facet filter', () => {
    const groups = buildProfessionGroups(flat, ['Tailoring']);
    expect(groups.map((g) => g.profession)).toEqual(['Tailoring']);
  });
});

describe('buildMainsList / charactersForMain', () => {
  it('one entry per distinct main among the given characters', () => {
    const mains = buildMainsList(flat);
    expect(mains.map((m) => m.mainName).sort()).toEqual(['Harima', 'Quixxie']);
    expect(mains.find((m) => m.mainName === 'Harima')?.characterCount).toBe(2);
  });

  it('charactersForMain returns every character for that main from the full list, ignoring filters', () => {
    const filtered = filterCharacters(flat, { ...DEFAULT_FILTERS, scope: 'Mains only' }); // would exclude Harimalt
    const chars = charactersForMain(flat, 'Harima');
    expect(chars.map((c) => c.characterName).sort()).toEqual(['Harima', 'Harimalt']);
    expect(filtered.some((c) => c.characterName === 'Harimalt')).toBe(false); // sanity: filter really did exclude it
  });
});

describe('recipeTone / groupRecipesByExpansion', () => {
  it('a search match takes priority over current/legacy', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    const recipe = harima.profs[0].recipes[0];
    expect(recipeTone(recipe, recipe.name, 'Dragon Isles')).toBe('match');
  });

  it('current expansion vs legacy', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    const recipe = harima.profs[0].recipes.find((r) => r.expansion === 'Khaz Algar')!;
    expect(recipeTone(recipe, '', 'Khaz Algar')).toBe('current');
    expect(recipeTone(recipe, '', 'Dragon Isles')).toBe('legacy');
  });

  it('groups recipes by expansion', () => {
    const harima = flat.find((c) => c.characterName === 'Harima')!;
    const groups = groupRecipesByExpansion(harima.profs[0].recipes);
    expect(groups.map((g) => g.expansion).sort()).toEqual(['Dragon Isles', 'Khaz Algar']);
  });
});

// Regression guard for a real footgun: a character with zero professions must not crash sorting/grouping.
describe('edge case: no professions', () => {
  const noProf: FlatCharacter = { id: 'x', characterName: 'Nobody', realm: 'R', class: 'Rogue', mainName: 'Nobody', isMain: true, days: 1, siblingCount: 1, profs: [] };

  it('sorts and filters without throwing', () => {
    expect(() => sortCharacters([noProf], 'skill', 1, ALL_EXPANSIONS_FILTER)).not.toThrow();
    expect(matchesFilters(noProf, DEFAULT_FILTERS)).toBe(true);
  });
});
