import { useCallback, useEffect, useMemo, useState } from 'react';
import { annotateWithTrades, buildSeasonLootReport, type SeasonLootRow } from '../../raid/lootLogic';
import { sampleLootRecords, sampleLootTrades, sampleNeedLosses } from '../../data/sampleLoot';
import { getRoster } from '../../data/rosterSource';
import { getCachedProfessions } from '../../professions/professionsSource';

export type SortKey = 'name' | 'needWinCount' | 'totalWon' | 'lossCount' | 'lastWonAt';

// Reuses electron.getLootLog() as-is -- it already returns the FULL shared season's
// records/trades (not scoped to one raid night; Loot History does its own client-side
// grouping-by-night on top of the same call), so this report needs no new IPC/proxy
// surface at all. In browser-preview mode (no window.electronAPI), falls back to the
// same sample loot data everything else in this pipeline uses.
export function useSeasonLootReport() {
  const electron = window.electronAPI;
  const [rows, setRows] = useState<SeasonLootRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [showGuests, setShowGuests] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('needWinCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback((): Promise<void> => {
    setRefreshing(true);
    const rosterPromise = getRoster().then((r) => r.raiders.map((raider) => raider.name));
    const lootPromise = electron ? electron.getLootLog() : Promise.resolve({ records: sampleLootRecords, trades: sampleLootTrades, needLosses: sampleNeedLosses, status: 'ok' as const });

    // Every guild character we know of (mains and alts), from the last professions scan --
    // what tells a raider from a one-night guest in a pug group. Null (no scan yet, or
    // browser preview) means "can't tell", so nobody gets hidden.
    const guildPromise = getCachedProfessions()
      .then((cached) => (cached ? new Set(cached.members.flatMap((m) => [m.mainName, ...m.characters.map((c) => c.characterName)])) : null))
      .catch(() => null);

    return Promise.all([rosterPromise, lootPromise, guildPromise])
      .then(([rosterNames, { records, trades, needLosses }, guildNames]) => {
        const entries = annotateWithTrades(records, trades);
        setRows(buildSeasonLootReport(entries, rosterNames, needLosses, guildNames));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [electron]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      setSortDir((prevDir) => (key === prevKey ? (prevDir === 'asc' ? 'desc' : 'asc') : 'asc'));
      return key;
    });
  }, []);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = showGuests ? rows : rows.filter((r) => !r.isGuest);
    const filtered = q ? shown.filter((r) => r.name.toLowerCase().includes(q)) : shown;
    const sorted = [...filtered].sort((a, b) => {
      const cmp = sortKey === 'name' ? a.name.localeCompare(b.name) : sortKey === 'lastWonAt' ? (a.lastWonAt ?? 0) - (b.lastWonAt ?? 0) : a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir, showGuests]);

  const guestCount = useMemo(() => rows.filter((r) => r.isGuest).length, [rows]);

  return {
    rows: visibleRows,
    loading,
    refreshing,
    refresh: load,
    query,
    setQuery,
    showGuests,
    setShowGuests,
    guestCount,
    sortKey,
    sortDir,
    toggleSort,
    empty: rows.length === 0,
  };
}
