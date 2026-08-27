import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProfessions, getCachedProfessions, subscribeProfessionsProgress } from '../../professions/professionsSource';
import { ALL_EXPANSIONS, computeExpansionOptions } from '../../professions/expansions';
import type { MemberProfessions } from '../../professions/types';
import type { ProfessionsProgress } from '../../electron';

interface Meta {
  fetchedAt: string;
  source: 'live' | 'sample';
}

const FRESHNESS_TICK_MS = 30_000;

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
}

const PROGRESS_PHASE_LABEL: Record<ProfessionsProgress['phase'], string> = {
  activity: 'Checking who’s been active',
  professions: 'Loading professions',
};

export function useProfessions() {
  const [members, setMembers] = useState<MemberProfessions[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<ProfessionsProgress | null>(null);
  const [query, setQuery] = useState('');
  const [expansionFilter, setExpansionFilter] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const applyResult = useCallback((result: { members: MemberProfessions[]; fetchedAt: string; source: 'live' | 'sample' }) => {
    setMembers(result.members);
    setMeta({ fetchedAt: result.fetchedAt, source: result.source });
    setLoadError(null);
    // Default to whichever expansion looks "current" for THIS data, computed fresh
    // every load rather than carried over stale from a previous fetch.
    setExpansionFilter(computeExpansionOptions(result.members).defaultExpansion);
  }, []);

  const loadLive = useCallback(
    (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      setProgress(null);
      return getProfessions()
        .then(applyResult)
        .catch(() => setLoadError('Could not load professions.'))
        .finally(() => {
          setRefreshing(false);
          setProgress(null);
        });
    },
    [applyResult],
  );

  // React 18 StrictMode double-invokes effects in dev, which would otherwise fire this
  // ~1000-character Blizzard API scan twice concurrently (confirmed live — it roughly
  // doubled request volume and triggered scattered failures). A ref survives both
  // invocations, so only the first actually starts a fetch.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // A full scan is a multi-minute, ~2000-request pull — instant-paint from the last
    // successful scan (electron/dataSources/professionsCache.cjs) instead of blocking
    // every launch on a rescan. Officers pull fresh data with the header's refresh
    // button; only a genuinely empty cache (first run) triggers a live scan on mount.
    void getCachedProfessions().then((cached) => {
      if (cached) {
        applyResult(cached);
      } else {
        void loadLive(false);
      }
    });
  }, [applyResult, loadLive]);

  useEffect(() => subscribeProfessionsProgress(setProgress), []);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), FRESHNESS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      if (m.mainName.toLowerCase().includes(q)) return true;
      return m.characters.some(
        (c) =>
          c.characterName.toLowerCase().includes(q) ||
          c.professions.some((p) => p.profession.toLowerCase().includes(q) || p.tiers.some((t) => t.knownRecipes.some((r) => r.toLowerCase().includes(q)))),
      );
    });
  }, [members, query]);

  const allProfessionNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of members ?? []) for (const c of m.characters) for (const p of c.professions) names.add(p.profession);
    return [...names].sort();
  }, [members]);

  const expansionOptions = useMemo(() => computeExpansionOptions(members ?? []).options, [members]);

  const progressLabel = progress
    ? `${PROGRESS_PHASE_LABEL[progress.phase]}… ${progress.done} / ${progress.total} (${Math.round((progress.done / progress.total) * 100)}%)`
    : 'Loading professions…';

  return {
    loading: members === null && !loadError,
    loadError,
    refreshing,
    progress,
    progressLabel,
    progressPercent: progress ? Math.round((progress.done / progress.total) * 100) : null,
    refresh: () => loadLive(true),
    members: filteredMembers,
    totalMembers: members?.length ?? 0,
    allProfessionNames,
    query,
    setQuery,
    expansionOptions,
    expansionFilter: expansionFilter ?? ALL_EXPANSIONS,
    setExpansionFilter,
    freshness:
      meta?.source === 'sample'
        ? 'Sample data — no live pipeline configured'
        : meta
          ? `Blizzard API, pulled ${relativeTime(meta.fetchedAt)} — active in the last 30 days`
          : '',
  };
}
