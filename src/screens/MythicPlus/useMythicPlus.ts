import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRoster } from '../../data/rosterSource';
import type { MythicPlusRun, Raider } from '../../scoring/types';

export interface MythicPlusRow {
  name: string;
  class: string;
  spec: string;
  portraitUrl: string | null;
  rioCurrent: number;
  runs: MythicPlusRun[];
}

function toRow(r: Raider): MythicPlusRow {
  return {
    name: r.name,
    class: r.class,
    spec: r.spec,
    portraitUrl: r.portraitUrl,
    rioCurrent: r.rioCurrent,
    runs: r.mythicPlusRuns,
  };
}

// Same swappable-seam reasoning as useSeasonLootReport -- getRoster() already carries
// mythicPlusRuns (real data via raiderio.cjs, synthesized in sample mode), so this
// needs no new IPC/proxy surface at all.
export function useMythicPlus() {
  const [rows, setRows] = useState<MythicPlusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback((): Promise<void> => {
    setRefreshing(true);
    return getRoster()
      .then((result) => {
        setRows(result.raiders.map(toRow).sort((a, b) => b.rioCurrent - a.rioCurrent));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  return {
    rows: visibleRows,
    loading,
    refreshing,
    refresh: load,
    query,
    setQuery,
    empty: rows.length === 0,
  };
}
