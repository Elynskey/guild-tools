import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { config, freshnessCopy } from '../../config';
import { getNightSnapshot, getRoster } from '../../data/rosterSource';
import { listRaidNights } from '../../raid/pullsSource';
import { ROLE_SECTIONS, rosterSummary, scoreRaider, sortBestFirst, sortWorstFirst } from '../../scoring/scoring';
import type { Band, Gates, Raider, Role, ScoredRaider, Window } from '../../scoring/types';
import type { NightSnapshotEntry, RaidNight, RealmMismatch } from '../../electron';
import { TILE_COLOR } from './bandVisuals';

export interface DisplayRaider extends ScoredRaider {
  expanded: boolean;
  /** Independent of `expanded` (the Performance ledger's feedback panel) -- this is the Roster table's gear-detail dropdown. */
  gearExpanded: boolean;
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
  realmMismatches: RealmMismatch[];
}

interface State {
  window: Window | null;
  role: 'all' | Role;
  band: 'all' | Band;
  query: string;
  sortWorst: boolean;
  open: string | null;
  openGear: string | null;
}

const TILE_DEFS: { key: Band; label: string; note: string }[] = [
  { key: 'green', label: 'Green', note: 'Gates clear, thresholds hit' },
  { key: 'yellow', label: 'Yellow', note: 'Short somewhere, or a death rate over 15%' },
  { key: 'red', label: 'Red', note: 'Below threshold, or a death rate over 30%' },
  { key: 'ineligible', label: 'Ineligible', note: 'Failed a gate — not scored' },
];

// Re-render periodically so the freshness line's relative time ("3 min ago") stays
// accurate for a dashboard left open, without needing a full re-fetch.
const FRESHNESS_TICK_MS = 30_000;

// Officers live-log raids and want to check what's killing people between pulls
// without remembering to hit Refresh -- keeps pulling fresh Warcraft Logs/RIO/gear/
// wowaudit data automatically. Deliberately NOT gated on window focus/visibility:
// the real workflow is WoW focused during the pull, tabbing over to this app between
// pulls, so data needs to already be fresh by the time they look, not start fetching
// only once they do.
const AUTO_REFRESH_MS = 3 * 60 * 1000;

export function useRaiderStatus() {
  const [roster, setRoster] = useState<Raider[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, forceTick] = useState(0);
  const [state, setState] = useState<State>({ window: null, role: 'all', band: 'all', query: '', sortWorst: true, open: null, openGear: null });

  // "Pick a log" for the night window instead of always the most recent report.
  // selectedNightCode stays null (meaning "use the roster's own baked-in night
  // fields, i.e. the latest report -- no extra fetch") until it's explicitly set to
  // something other than the latest night in the list.
  const [nights, setNights] = useState<RaidNight[]>([]);
  const [selectedNightCode, setSelectedNightCode] = useState<string | null>(null);
  const [nightSnapshot, setNightSnapshot] = useState<Record<string, NightSnapshotEntry> | null>(null);
  const [loadingNightSnapshot, setLoadingNightSnapshot] = useState(false);

  // rio/ilvl gates used to be a hardcoded client constant (config.gates) -- now
  // GM-editable from Settings. green/yellow band thresholds aren't part of that (not
  // asked for), so those still come from config.gates; only rio/ilvl override.
  // Falls back to config.gates.rio/ilvl outside Electron (sample mode) or before the
  // real fetch resolves.
  const [gates, setGates] = useState<Gates>(config.gates);
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSettings().then((s) => setGates({ ...config.gates, rio: s.gates.rio, ilvl: s.gates.ilvl }));
  }, []);

  useEffect(() => {
    listRaidNights().then(setNights).catch(() => {});
  }, []);

  const latestNightCode = nights[0]?.code ?? null;

  useEffect(() => {
    if (!selectedNightCode || selectedNightCode === latestNightCode) {
      setNightSnapshot(null); // the roster's own night fields are already the latest report -- no fetch needed
      return;
    }
    let cancelled = false;
    setLoadingNightSnapshot(true);
    getNightSnapshot(selectedNightCode)
      .then((snapshot) => { if (!cancelled) setNightSnapshot(snapshot); })
      .finally(() => { if (!cancelled) setLoadingNightSnapshot(false); });
    return () => { cancelled = true; };
  }, [selectedNightCode, latestNightCode]);

  const isFetchingRef = useRef(false);
  const load = useCallback((isRefresh: boolean) => {
    if (isFetchingRef.current) return Promise.resolve(); // auto-refresh timer firing mid-fetch (e.g. a slow WCL pull) -- skip, don't stack requests
    isFetchingRef.current = true;
    if (isRefresh) setRefreshing(true);
    return getRoster()
      .then((result) => {
        setRoster(result.raiders);
        setMeta({ fetchedAt: result.fetchedAt, heroicBossesKilled: result.heroicBossesKilled, source: result.source, realmMismatches: result.realmMismatches });
        setLoadError(null);
      })
      .catch(() => setLoadError('Could not load the roster.'))
      .finally(() => {
        setRefreshing(false);
        isFetchingRef.current = false;
      });
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

  useEffect(() => {
    const id = setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const win: Window = state.window ?? config.defaultWindow;

  // A picked-log snapshot only overrides the night* fields -- tier-to-date fields
  // (perf, deaths, pulls, deathCauses) stay whatever the roster fetch computed,
  // since "Season Overview" always means the same thing regardless of which log
  // is selected for the night view.
  const rosterForWindow = useMemo(() => {
    if (win !== 'night' || !nightSnapshot || !roster) return roster;
    return roster.map((r) => (nightSnapshot[r.name] ? { ...r, ...nightSnapshot[r.name] } : r));
  }, [roster, win, nightSnapshot]);

  const all = useMemo<ScoredRaider[]>(
    () => (rosterForWindow ? rosterForWindow.map((r) => scoreRaider(r, win, gates)) : []),
    [rosterForWindow, win, gates],
  );

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
        const rows = filteredSorted
          .filter((r) => r.role === g.key)
          .map((r) => ({ ...r, expanded: state.open === r.name, gearExpanded: state.openGear === r.name }));
        return { ...g, rows, count: rows.length };
      })
      .filter((g) => g.rows.length > 0);
  }, [filteredSorted, state.open, state.openGear]);

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
    { value: 'rolled', label: 'Season Overview' },
    { value: 'night', label: 'Raid Night' },
  ];

  const heroicKilled = meta?.heroicBossesKilled ?? config.tier.sampleModeKilled;

  return {
    loading: roster === null && !loadError,
    loadError,
    refreshing,
    refresh: () => load(true),
    window: win,
    setWindow: (v: string) => setState((s) => ({ ...s, window: v as Window, open: null, openGear: null })),
    windowTabs,
    nights,
    selectedNightCode: selectedNightCode ?? latestNightCode,
    setSelectedNightCode: (code: string) => { setSelectedNightCode(code); setState((s) => ({ ...s, open: null, openGear: null })); },
    loadingNightSnapshot,
    role: state.role,
    setRole: (v: string) => setState((s) => ({ ...s, role: v as Role | 'all', open: null, openGear: null })),
    roleTabs,
    query: state.query,
    setQuery: (v: string) => setState((s) => ({ ...s, query: v })),
    sortWorst: state.sortWorst,
    setSortWorst: (v: boolean) => setState((s) => ({ ...s, sortWorst: v })),
    toggleBand: (key: Band) => setState((s) => ({ ...s, band: s.band === key ? 'all' : key, open: null, openGear: null })),
    band: state.band,
    tiles,
    groups,
    empty: groups.length === 0,
    open: state.open,
    toggleRow: (name: string) => setState((s) => ({ ...s, open: s.open === name ? null : name })),
    toggleGearRow: (name: string) => setState((s) => ({ ...s, openGear: s.openGear === name ? null : name })),
    trendHeader: win === 'night' ? 'That Night' : 'Trend',
    avgLine: summary.headline,
    guildWell: summary.goingWell,
    guildStop: summary.stoppingUs,
    guildGate: summary.unscored,
    realmMismatches: meta?.realmMismatches ?? [],
    freshness: meta ? freshnessCopy(meta.fetchedAt, meta.source) : '',
    progressionFraction: `${heroicKilled}/${config.tier.totalBosses}`,
    dataSource: meta?.source ?? 'sample',
    rioGateText: `${gates.rio}`,
    ilvlGateText: `${gates.ilvl}`,
  };
}
