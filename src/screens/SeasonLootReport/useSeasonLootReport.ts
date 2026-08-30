import { useCallback, useEffect, useMemo, useState } from 'react';
import { annotateWithTrades, buildSeasonLootReport, type SeasonLootRow } from '../../raid/lootLogic';
import { sampleLootRecords, sampleLootTrades } from '../../data/sampleLoot';
import { getRoster } from '../../data/rosterSource';

export type SortKey = 'name' | 'needWinCount' | 'totalWon' | 'lastWonAt';

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
  const [sortKey, setSortKey] = useState<SortKey>('needWinCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback((): Promise<void> => {
    setRefreshing(true);
    const rosterPromise = getRoster().then((r) => r.raiders.map((raider) => raider.name));
    const lootPromise = electron ? electron.getLootLog() : Promise.resolve({ records: sampleLootRecords, trades: sampleLootTrades, status: 'ok' as const });

    return Promise.all([rosterPromise, lootPromise])
      .then(([rosterNames, { records, trades }]) => {
        const entries = annotateWithTrades(records, trades);
        setRows(buildSeasonLootReport(entries, rosterNames));
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
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    const sorted = [...filtered].sort((a, b) => {
      const cmp = sortKey === 'name' ? a.name.localeCompare(b.name) : sortKey === 'lastWonAt' ? (a.lastWonAt ?? 0) - (b.lastWonAt ?? 0) : a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir]);

  return {
    rows: visibleRows,
    loading,
    refreshing,
    refresh: load,
    query,
    setQuery,
    sortKey,
    sortDir,
    toggleSort,
    empty: rows.length === 0,
  };
}
