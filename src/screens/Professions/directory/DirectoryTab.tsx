import { useEffect, useMemo, useState } from 'react';
import { Input } from '../../../design-system/Input';
import { Select } from '../../../design-system/Select';
import { Tag } from '../../../design-system/Tag';
import { Button } from '../../../design-system/Button';
import { professionIconUrl, ALL_PROFESSIONS } from '../../../professions/professionCatalog';
import {
  flattenCharacters,
  filterCharacters,
  sortCharacters,
  paginate,
  buildSuggestions,
  buildProfessionGroups,
  buildMainsList,
  charactersForMain,
  ALL_EXPANSIONS_FILTER,
  type DirectoryFilters,
  type Scope,
  type SortKey,
  type SortDir,
} from '../../../professions/directoryLogic';
import { SearchSuggestions } from './SearchSuggestions';
import { TableView } from './TableView';
import { ByProfessionView } from './ByProfessionView';
import { RosterDetailView } from './RosterDetailView';
import { Pager } from './Pager';
import type { MemberProfessions } from '../../../professions/types';

const PAGE_SIZE = 50;
type ViewKey = 'table' | 'profession' | 'detail';
const VIEW_OPTIONS: { key: ViewKey; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'profession', label: 'By profession' },
  { key: 'detail', label: 'Roster + detail' },
];
const SEEN_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];
const SCOPE_OPTIONS: Scope[] = ['All characters', 'Mains only', 'Alts only'];

interface DirectoryTabProps {
  members: MemberProfessions[];
  expansion: string;
  expansionOptions: string[];
  onExpansionChange: (v: string) => void;
}

export function DirectoryTab({ members, expansion, expansionOptions, onExpansionChange }: DirectoryTabProps) {
  const allFlat = useMemo(() => flattenCharacters(members), [members]);

  const [query, setQuery] = useState('');
  const [suppressSuggest, setSuppressSuggest] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scope, setScope] = useState<Scope>('All characters');
  const [seenWithinDays, setSeenWithinDays] = useState(30);
  const [professions, setProfessions] = useState<string[]>([]);
  const [recipeFilter, setRecipeFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>(1);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewKey>('table');
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [expandedProfessions, setExpandedProfessions] = useState<Set<string>>(new Set());
  const [selectedMain, setSelectedMain] = useState<string | null>(null);

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    const filters: DirectoryFilters = { query, expansion, scope, seenWithinDays, professions, recipeFilter };
    return filterCharacters(allFlat, filters);
  }, [allFlat, query, expansion, scope, seenWithinDays, professions, recipeFilter]);
  const sorted = useMemo(() => sortCharacters(filtered, sortKey, sortDir, expansion), [filtered, sortKey, sortDir, expansion]);
  const mainsF = useMemo(() => buildMainsList(filtered), [filtered]);
  const profGroups = useMemo(() => buildProfessionGroups(filtered, professions), [filtered, professions]);
  const suggestionGroups = useMemo(() => buildSuggestions(allFlat, query, expansion), [allFlat, query, expansion]);

  const isDetail = view === 'detail';
  const { slice: mainsSlice, page: mPage, pages: mPages } = paginate(mainsF, page, PAGE_SIZE);
  const { slice: charSlice, page: cPage, pages: cPages } = paginate(sorted, page, PAGE_SIZE);

  // Keep the selected main valid as filters/pages change; default to the first result.
  useEffect(() => {
    if (!isDetail) return;
    if (selectedMain && mainsF.some((m) => m.mainName === selectedMain)) return;
    setSelectedMain(mainsSlice[0]?.mainName ?? mainsF[0]?.mainName ?? null);
  }, [isDetail, mainsF, mainsSlice, selectedMain]);

  const recipeFilterKnownCount = recipeFilter ? allFlat.filter((c) => c.profs.some((p) => p.recipes.some((r) => r.name === recipeFilter))).length : 0;
  const hasFilters = professions.length > 0 || !!query || !!recipeFilter || scope !== 'All characters' || seenWithinDays !== 30;

  const clearFilters = () => {
    setProfessions([]);
    setQuery('');
    setRecipeFilter(null);
    setScope('All characters');
    setSeenWithinDays(30);
    resetPage();
  };

  const toggleSort = (key: SortKey) => {
    setSortDir((prevDir) => (sortKey === key ? ((prevDir * -1) as SortDir) : 1));
    setSortKey(key);
    resetPage();
  };

  const toggleProfessionChip = (p: string) => {
    setProfessions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
    resetPage();
  };

  const toggleRow = (id: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openMemberDetail = (mainName: string) => {
    setView('detail');
    setSelectedMain(mainName);
  };

  const detailCharacters = selectedMain ? charactersForMain(allFlat, selectedMain) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 420px', minWidth: 320 }}>
          <Input
            label="Search the guild"
            icon="search"
            placeholder='Character, profession or recipe — e.g. "flask", "Enchant Ring", "Vadailla"'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuppressSuggest(false);
              resetPage();
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <SearchSuggestions
            groups={suggestionGroups}
            visible={searchFocused && !!query.trim() && !suppressSuggest}
            onPickCharacter={(name) => {
              setQuery(name);
              setSuppressSuggest(true);
              setSearchFocused(false);
              resetPage();
            }}
            onPickProfession={(name) => {
              setQuery('');
              setSuppressSuggest(true);
              setSearchFocused(false);
              setProfessions([name]);
              resetPage();
            }}
            onPickRecipe={(name) => {
              setQuery('');
              setSuppressSuggest(true);
              setSearchFocused(false);
              setRecipeFilter(name);
              resetPage();
            }}
          />
        </div>
        <div style={{ width: 210 }}>
          <Select label="Expansion" options={[ALL_EXPANSIONS_FILTER, ...expansionOptions.filter((e) => e !== ALL_EXPANSIONS_FILTER)]} value={expansion} onChange={(e) => onExpansionChange(e.target.value)} />
        </div>
        <div style={{ width: 170 }}>
          <Select
            label="Last seen"
            options={SEEN_OPTIONS}
            value={String(seenWithinDays)}
            onChange={(e) => {
              setSeenWithinDays(Number(e.target.value));
              resetPage();
            }}
          />
        </div>
        <div style={{ width: 150 }}>
          <Select
            label="Show"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              resetPage();
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', padding: '12px 14px', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', borderRadius: 5 }}>
        <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)', paddingTop: 5, width: 78, flex: 'none' }}>Profession</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {ALL_PROFESSIONS.map((p) => (
            <Tag key={p} selected={professions.includes(p)} onClick={() => toggleProfessionChip(p)}>
              <img src={professionIconUrl(p)} alt="" style={{ width: 15, height: 15, borderRadius: 2, border: '1px solid var(--border-iron)', verticalAlign: -3, marginRight: 6, objectFit: 'cover' }} />
              {p}
            </Tag>
          ))}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" iconLeft="x" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {recipeFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'rgba(212,179,88,.07)' }}>
          <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-gold)' }}>Recipe lookup</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', letterSpacing: '.03em', color: 'var(--text-strong)' }}>{recipeFilter}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>{recipeFilterKnownCount} characters know it</span>
          <div style={{ marginLeft: 'auto' }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="x"
              onClick={() => {
                setRecipeFilter(null);
                resetPage();
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{isDetail ? mainsF.length : filtered.length}</span> {isDetail ? 'members' : 'characters'}
          {isDetail && (
            <span>
              {' '}
              · <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{filtered.length}</span> characters
            </span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 3, border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)' }}>
          {VIEW_OPTIONS.map((v) => (
            <div
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                padding: '6px 13px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 'var(--text-label)',
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                background: view === v.key ? 'var(--action-secondary-hover)' : 'transparent',
                color: view === v.key ? 'var(--text-gold)' : 'var(--text-muted)',
              }}
            >
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {view === 'table' && (
        <TableView rows={charSlice} expansion={expansion} query={query} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} openRows={openRows} onToggleRow={toggleRow} />
      )}
      {view === 'profession' && (
        <ByProfessionView
          groups={profGroups}
          expandedProfessions={expandedProfessions}
          onShowAll={(p) => setExpandedProfessions((prev) => new Set(prev).add(p))}
          onOpenMember={openMemberDetail}
        />
      )}
      {view === 'detail' && selectedMain && (
        <RosterDetailView
          railMains={mainsSlice}
          railLabel={`${mainsF.length} members`}
          selectedMain={selectedMain}
          onSelectMain={setSelectedMain}
          detailCharacters={detailCharacters}
          expansion={expansion}
          query={query}
        />
      )}

      <Pager
        page={isDetail ? mPage : cPage}
        pages={isDetail ? mPages : cPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
