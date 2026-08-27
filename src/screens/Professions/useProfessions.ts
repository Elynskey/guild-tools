import { useCallback, useEffect, useRef, useState } from 'react';
import { getProfessions, getCachedProfessions, subscribeProfessionsProgress, getCachedRecipeCatalogue, getRecipeCatalogue } from '../../professions/professionsSource';
import type { MemberProfessions, RecipeCatalogue } from '../../professions/types';
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

/**
 * Data layer only — members + the recipe catalogue + freshness/refresh/progress. Filtering,
 * sorting, view state, tab state etc. live in the tab components (directory/coverage/requests),
 * since those are largely independent of each other and of when the data itself refreshes.
 */
export function useProfessions() {
  const [members, setMembers] = useState<MemberProfessions[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<ProfessionsProgress | null>(null);
  const [catalogue, setCatalogue] = useState<RecipeCatalogue | null>(null);
  const [, forceTick] = useState(0);

  const applyResult = useCallback((result: { members: MemberProfessions[]; fetchedAt: string; source: 'live' | 'sample' }) => {
    setMembers(result.members);
    setMeta({ fetchedAt: result.fetchedAt, source: result.source });
    setLoadError(null);
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
    // The recipe catalogue is cheap to instant-paint from cache and self-limits its own
    // live refetch to a 7-day TTL server-side (electron/dataSources/recipeCatalogueCache.cjs),
    // so it's safe to always follow the cache read with a "live" call here.
    void getCachedRecipeCatalogue().then((cached) => setCatalogue(cached.catalogue));
    void getRecipeCatalogue().then((live) => setCatalogue(live.catalogue));
  }, [applyResult, loadLive]);

  useEffect(() => subscribeProfessionsProgress(setProgress), []);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), FRESHNESS_TICK_MS);
    return () => clearInterval(id);
  }, []);

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
    members: members ?? [],
    catalogue: catalogue ?? {},
    freshness:
      meta?.source === 'sample'
        ? 'Sample data — no live pipeline configured'
        : meta
          ? `Synced ${relativeTime(meta.fetchedAt)} · Blizzard API`
          : '',
    freshnessJustSynced: meta?.source === 'live' && Date.now() - new Date(meta.fetchedAt).getTime() < 60_000,
  };
}
