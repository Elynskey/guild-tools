import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPullFeedback, listRaidNights } from '../../raid/pullsSource';
import { groupMechanicsNeedingWorkByBoss, groupPullsByBoss } from '../../raid/pullLogic';
import { getRoster } from '../../data/rosterSource';
import { buildDeathMechanicsReport, buildDeathRateComparison } from '../../scoring/deathMechanics';
import type { Pull, RaidNight } from '../../electron';
import type { Raider } from '../../scoring/types';

export function usePullFeedback() {
  const [nights, setNights] = useState<RaidNight[] | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pulls, setPulls] = useState<Pull[] | null>(null);
  const [roster, setRoster] = useState<Raider[]>([]);
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

  // Tier-wide, independent of which single raid night is selected below -- only
  // needs the roster's own tier-to-date deathCauses field, not the full scoring/
  // gates/bands pipeline Raider Status runs.
  useEffect(() => {
    getRoster().then((result) => setRoster(result.raiders));
  }, []);

  const deathMechanics = useMemo(
    () => buildDeathMechanicsReport(roster.map((r) => ({ name: r.name, deathCausesInWindow: r.deathCauses }))),
    [roster],
  );

  const deathRateComparison = useMemo(
    () => buildDeathRateComparison(roster.map((r) => ({ name: r.name, deathsInWindow: r.deaths, pullsInWindow: r.pulls }))),
    [roster],
  );

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
  const mechanicsNeedingWork = pulls ? groupMechanicsNeedingWorkByBoss(pulls) : [];

  return {
    nights: nights ?? [],
    selectedCode,
    selectNight,
    bossGroups,
    mechanicsNeedingWork,
    deathMechanics,
    deathRateComparison,
    totalPulls: pulls?.length ?? 0,
    kills: pulls?.filter((p) => p.kill).length ?? 0,
    loading: loadingNights || (loadingPulls && pulls === null),
    refreshing: loadingPulls,
    error,
    empty: pulls !== null && pulls.length === 0,
  };
}
