import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProfessions } from '../../professions/professionsSource';
import { ALL_EXPANSIONS, computeExpansionOptions } from '../../professions/expansions';
import type { MemberProfessions } from '../../professions/types';

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

export function useProfessions() {
  const [members, setMembers] = useState<MemberProfessions[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [expansionFilter, setExpansionFilter] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const load = useCallback((isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    return getProfessions()
      .then((result) => {
        setMembers(result.members);
        setMeta({ fetchedAt: result.fetchedAt, source: result.source });
        setLoadError(null);
        // Default to whichever expansion looks "current" for THIS data, computed fresh
        // every load rather than carried over stale from a previous fetch.
        setExpansionFilter(computeExpansionOptions(result.members).defaultExpansion);
      })
      .catch(() => setLoadError('Could not load professions.'))
      .finally(() => setRefreshing(false));
  }, []);

  // React 18 StrictMode double-invokes effects in dev, which would otherwise fire this
  // ~1000-character Blizzard API scan twice concurrently (confirmed live — it roughly
  // doubled request volume and triggered scattered failures). A ref survives both
  // invocations, so only the first actually starts a fetch.
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

  return {
    loading: members === null && !loadError,
    loadError,
    refreshing,
    refresh: () => load(true),
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
