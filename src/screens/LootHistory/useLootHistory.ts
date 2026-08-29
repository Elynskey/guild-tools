import { useCallback, useEffect, useMemo, useState } from 'react';
import { annotateWithTrades, groupLootByNight, needWinCount } from '../../raid/lootLogic';
import type { LootNight } from '../../raid/lootLogic';
import { sampleLootRecords, sampleLootTrades } from '../../data/sampleLoot';

type LogStatus = 'ok' | 'not_configured' | 'addon_not_installed';

export function useLootHistory() {
  const electron = window.electronAPI;
  const [status, setStatus] = useState<LogStatus>('ok');
  const [nights, setNights] = useState<LootNight[]>([]);
  const [selectedNightKey, setSelectedNightKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [wowPath, setWowPathState] = useState<{ configured: string | null; resolved: string | null; valid: boolean } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!electron) {
      // Browser/dev-preview mode: no addon, no filesystem -- show sample data so the screen is reviewable.
      const entries = annotateWithTrades(sampleLootRecords, sampleLootTrades);
      setNights(groupLootByNight(entries));
      setStatus('ok');
      return Promise.resolve();
    }
    setRefreshing(true);
    return Promise.all([
      electron.getLootLog().then((result) => {
        const entries = annotateWithTrades(result.records, result.trades);
        setNights(groupLootByNight(entries));
        setStatus(result.status);
      }),
      electron.getWowPathConfig().then(setWowPathState),
    ]).finally(() => setRefreshing(false));
  }, [electron]);

  useEffect(() => {
    load();
  }, [load]);

  // Loot syncs in from whoever's raiding right now, so this screen polls for it rather
  // than requiring a manual reopen -- 30s keeps it feeling live without hammering the
  // proxy. Stops the moment the screen unmounts.
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const selectedNight = nights.find((n) => n.key === selectedNightKey) ?? nights[0] ?? null;

  const visibleEntries = useMemo(() => {
    if (!selectedNight) return [];
    const q = query.trim().toLowerCase();
    if (!q) return selectedNight.entries;
    return selectedNight.entries.filter((e) => e.winner.toLowerCase().includes(q) || e.tradedTo?.toLowerCase().includes(q));
  }, [selectedNight, query]);

  const winCounts = useMemo(() => {
    if (!selectedNight) return new Map<string, number>();
    const names = new Set(selectedNight.entries.map((e) => e.winner));
    return new Map([...names].map((name) => [name, needWinCount(selectedNight.entries, name)]));
  }, [selectedNight]);

  const pickWowFolder = useCallback(() => {
    if (!electron) return;
    electron.pickWowFolder().then((picked) => {
      if (!picked) return;
      electron.setWowPath(picked).then((cfg) => {
        setWowPathState(cfg);
        load();
      });
    });
  }, [electron, load]);

  const installAddon = useCallback(() => {
    if (!electron) return;
    setInstalling(true);
    setInstallMessage(null);
    electron
      .installLootAddon()
      .then((result) => {
        setInstallMessage(result.ok ? `Installed to ${result.dest}. Restart WoW (or /reload) to pick it up.` : result.error);
        if (result.ok) load();
      })
      .finally(() => setInstalling(false));
  }, [electron, load]);

  return {
    status,
    nights,
    selectedNightKey: selectedNight?.key ?? null,
    setSelectedNightKey,
    visibleEntries,
    winCounts,
    query,
    setQuery,
    wowPath,
    pickWowFolder,
    installAddon,
    installing,
    installMessage,
    refresh: load,
    refreshing,
    empty: nights.length === 0,
  };
}
