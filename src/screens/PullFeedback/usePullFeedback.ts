import { useCallback, useEffect, useState } from 'react';
import { getPullFeedback, listRaidNights } from '../../raid/pullsSource';
import { groupPullsByBoss, rankMechanicsNeedingWork } from '../../raid/pullLogic';
import type { Pull, RaidNight } from '../../electron';

export function usePullFeedback() {
  const [nights, setNights] = useState<RaidNight[] | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pulls, setPulls] = useState<Pull[] | null>(null);
  const [loadingNights, setLoadingNights] = useState(true);
  const [loadingPulls, setLoadingPulls] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRaidNights()
      .then((result) => {
        setNights(result);
        if (result.length > 0) setSelectedCode(result[0].code);
      })
      .catch(() => setError('Could not load raid nights.'))
      .finally(() => setLoadingNights(false));
  }, []);

  useEffect(() => {
    if (!selectedCode) return;
    setLoadingPulls(true);
    setError(null);
    getPullFeedback(selectedCode)
      .then((result) => setPulls(result.pulls))
      .catch(() => setError('Could not load this raid night.'))
      .finally(() => setLoadingPulls(false));
  }, [selectedCode]);

  const selectNight = useCallback((code: string) => setSelectedCode(code), []);

  const bossGroups = pulls ? groupPullsByBoss(pulls) : [];
  const mechanicsNeedingWork = pulls ? rankMechanicsNeedingWork(pulls) : [];

  return {
    nights: nights ?? [],
    selectedCode,
    selectNight,
    bossGroups,
    mechanicsNeedingWork,
    totalPulls: pulls?.length ?? 0,
    kills: pulls?.filter((p) => p.kill).length ?? 0,
    loading: loadingNights || (loadingPulls && pulls === null),
    refreshing: loadingPulls,
    error,
    empty: pulls !== null && pulls.length === 0,
  };
}
