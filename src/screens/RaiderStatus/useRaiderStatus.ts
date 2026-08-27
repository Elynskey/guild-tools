import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { config, freshnessCopy } from '../../config';
import { getRoster } from '../../data/rosterSource';
import { ROLE_SECTIONS, rosterSummary, scoreRaider, sortBestFirst, sortWorstFirst } from '../../scoring/scoring';
import type { Band, Raider, Role, ScoredRaider, Window } from '../../scoring/types';
import { TILE_COLOR } from './bandVisuals';

export interface DisplayRaider extends ScoredRaider {
  expanded: boolean;
}

export interface RoleGroup {
  key: Role;
  label: string;
  icon: string;
  perfHeader: string;
  count: number;
  rows: DisplayRaider[];
}

export interface Tile {
  key: Band;
  label: string;
  color: string;
  count: number;
  pct: string;
  edge: string;
  labelColor: string;
  countColor: string;
  title: string;
}

interface Meta {
  fetchedAt: string;
  heroicBossesKilled: number | null;
  source: 'live' | 'sample';
}

interface State {
  window: Window | null;
  role: 'all' | Role;
  band: 'all' | Band;
  query: string;
  sortWorst: boolean;
  open: string | null;
}

const TILE_DEFS: { key: Band; label: string; note: string }[] = [
  { key: 'green', label: 'Green', note: 'Gates clear, thresholds hit' },
  { key: 'yellow', label: 'Yellow', note: 'Short somewhere, or one death' },
  { key: 'red', label: 'Red', note: 'Below threshold, or 2+ deaths' },
  { key: 'ineligible', label: 'Ineligible', note: 'Failed a gate — not scored' },
];

// Re-render periodically so the freshness line's relative time ("3 min ago") stays
// accurate for a dashboard left open, without needing a full re-fetch.
const FRESHNESS_TICK_MS = 30_000;

export function useRaiderStatus() {
  const [roster, setRoster] = useState<Raider[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, forceTick] = useState(0);
  const [state, setState] = useState<State>({ window: null, role: 'all', band: 'all', query: '', sortWorst: true, open: null });

  const load = useCallback((isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    return getRoster()
      .then((result) => {
        setRoster(result.raiders);
        setMeta({ fetchedAt: result.fetchedAt, heroicBossesKilled: result.heroicBossesKilled, source: result.source });
        setLoadError(null);
      })
      .catch(() => setLoadError('Could not load the roster.'))
      .finally(() => setRefreshing(false));
  }, []);

  // See the matching comment in useProfessions.ts — StrictMode double-invokes this
  // effect in dev, which would otherwise fire the live pipeline fetch twice at once.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void load(false);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), FRESHNESS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const win: Window = state.window ?? config.defaultWindow;

  const all = useMemo<ScoredRaider[]>(() => (roster ? roster.map((r) => scoreRaider(r, win, config.gates)) : []), [roster, win]);

  const summary = useMemo(() => rosterSummary(all, win), [all, win]);

  const tiles = useMemo<Tile[]>(
    () =>
      TILE_DEFS.map((t) => ({
        key: t.key,
        label: t.label,
        color: TILE_COLOR[t.key],
        count: summary.counts[t.key],
        pct: `${all.length ? (summary.counts[t.key] / all.length) * 100 : 0}%`,
        edge: state.band === t.key ? 'var(--border-strong)' : 'var(--border-hairline)',
        labelColor: state.band === t.key ? 'var(--text-strong)' : 'var(--text-muted)',
        countColor: state.band === t.key ? TILE_COLOR[t.key] : 'var(--text-body)',
        title: state.band === t.key ? `${t.label}: filtering — click to clear` : `${t.label}: ${t.note}`,
      })),
    [summary.counts, all.length, state.band],
  );

  const filteredSorted = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const rows = all.filter(
      (r) =>
        (state.role === 'all' || r.role === state.role) &&
        (state.band === 'all' || r.band === state.band) &&
        (!q || r.name.toLowerCase().includes(q) || r.subline.toLowerCase().includes(q)),
    );
    rows.sort(state.sortWorst ? sortWorstFirst : sortBestFirst);
    return rows;
  }, [all, state.role, state.band, state.query, state.sortWorst]);

  const groups = useMemo<RoleGroup[]>(() => {
    return ROLE_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      icon: section.icon,
      perfHeader: section.perfHeader,
      count: 0,
      rows: [] as DisplayRaider[],
    }))
      .map((g) => {
        const rows = filteredSorted.filter((r) => r.role === g.key).map((r) => ({ ...r, expanded: state.open === r.name }));
        return { ...g, rows, count: rows.length };
      })
      .filter((g) => g.rows.length > 0);
  }, [filteredSorted, state.open]);

  const roleTabs = useMemo(
    () => [
      { value: 'all', label: 'Full roster', count: all.length },
      { value: 'tank', label: 'Tanks', count: all.filter((r) => r.role === 'tank').length },
      { value: 'healer', label: 'Healers', count: all.filter((r) => r.role === 'healer').length },
      { value: 'dps', label: 'Damage', count: all.filter((r) => r.role === 'dps').length },
    ],
    [all],
  );

  const windowTabs = [
    { value: 'rolled', label: 'Rolled-up' },
    { value: 'night', label: 'Last raid night' },
  ];

  const heroicKilled = meta?.heroicBossesKilled ?? config.tier.sampleModeKilled;

  return {
    loading: roster === null && !loadError,
    loadError,
    refreshing,
    refresh: () => load(true),
    window: win,
    setWindow: (v: string) => setState((s) => ({ ...s, window: v as Window, open: null })),
    windowTabs,
    role: state.role,
    setRole: (v: string) => setState((s) => ({ ...s, role: v as Role | 'all', open: null })),
    roleTabs,
    query: state.query,
    setQuery: (v: string) => setState((s) => ({ ...s, query: v })),
    sortWorst: state.sortWorst,
    setSortWorst: (v: boolean) => setState((s) => ({ ...s, sortWorst: v })),
    toggleBand: (key: Band) => setState((s) => ({ ...s, band: s.band === key ? 'all' : key, open: null })),
    band: state.band,
    tiles,
    groups,
    empty: groups.length === 0,
    open: state.open,
    toggleRow: (name: string) => setState((s) => ({ ...s, open: s.open === name ? null : name })),
    trendHeader: win === 'night' ? 'Last night' : 'Trend',
    avgLine: summary.headline,
    guildWell: summary.goingWell,
    guildStop: summary.stoppingUs,
    guildGate: summary.unscored,
    freshness: meta ? freshnessCopy(meta.fetchedAt, meta.source) : '',
    progressionFraction: `${heroicKilled}/${config.tier.totalBosses}`,
    dataSource: meta?.source ?? 'sample',
    rioGateText: `${config.gates.rio}`,
    ilvlGateText: `${config.gates.ilvl}`,
  };
}
