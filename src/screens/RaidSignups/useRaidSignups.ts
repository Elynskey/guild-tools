import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssignmentTier, RaidAssignment, RaidRole, RaidSignupEntry, RaidSignupPost, TeamType } from '../../electron';
import { getRoster } from '../../data/rosterSource';
import type { Raider } from '../../scoring/types';
import { utilityGainedBy, raidBuffCoverage, dpsRangeForSpec } from '../../raid/raidBuffs';

const ROLES: RaidRole[] = ['tank', 'healer', 'dps'];

export function useRaidSignups() {
  const electron = window.electronAPI;
  const [posts, setPosts] = useState<RaidSignupPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Raider[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!electron) return;
    electron.listRaidSignups().then((list) => {
      setPosts(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    });
  }, [electron]);

  useEffect(() => {
    refresh();
    void getRoster().then((r) => setRoster(r.raiders));
  }, [refresh]);

  const selected = posts.find((p) => p.id === selectedId) ?? null;

  /** Returns whether it succeeded so the "New" dialog can stay open and show the error on failure, instead of closing immediately and discarding it. */
  const create = useCallback(
    (raidName: string, teamType: TeamType, signupText: string): Promise<boolean> => {
      if (!electron) return Promise.resolve(false);
      setCreating(true);
      setCreateError(null);
      return electron
        .createRaidSignup(raidName, teamType, signupText)
        .then((post) => {
          setPosts((prev) => [post, ...prev]);
          setSelectedId(post.id);
          return true;
        })
        .catch((err: Error) => {
          setCreateError(err.message || 'Could not post this signup to Discord.');
          return false;
        })
        .finally(() => setCreating(false));
    },
    [electron],
  );

  const rosterByName = useMemo(() => new Map(roster.map((r) => [r.name.toLowerCase(), r])), [roster]);

  /** Roster match (perf) for a signup's character name -- null if this character isn't on the roster (an alt, a typo, or someone new). Only used for perf display now; class comes from the signup itself. */
  const matchRoster = useCallback((characterName: string) => rosterByName.get(characterName.toLowerCase()) ?? null, [rosterByName]);

  /** Class for a signup -- self-reported at signup time (a real Blizzard class picked in Discord), falling back to a roster-name match only for signups made before that field existed. */
  const classFor = useCallback((signup: RaidSignupEntry) => signup.class ?? matchRoster(signup.characterName)?.class ?? null, [matchRoster]);

  /** Spec for a signup -- self-reported alongside class, null for signups made before that field existed (no roster fallback: the roster doesn't track "spec they signed up to raid as," only whatever they're playing right now). */
  const specFor = useCallback((signup: RaidSignupEntry) => signup.spec ?? null, []);

  const primarySignupsFor = useCallback(
    (post: RaidSignupPost, role: RaidRole) =>
      post.assignments[role]
        .filter((a) => a.tier === 'primary')
        .map((a) => post.signups.find((s) => s.discordUserId === a.discordUserId))
        .filter((s): s is RaidSignupEntry => !!s),
    [],
  );

  /** Utility this signup's class would add on top of whoever is already assigned primary in this role -- empty if their class brings nothing tracked, or nothing new. */
  const utilityFor = useCallback(
    (post: RaidSignupPost, role: RaidRole, characterName: string) => {
      const signup = post.signups.find((s) => s.characterName === characterName);
      const candidateClass = signup ? classFor(signup) : matchRoster(characterName)?.class;
      if (!candidateClass) return [];
      const primaryClasses = primarySignupsFor(post, role).map(classFor).filter((c): c is string => !!c);
      return utilityGainedBy(candidateClass, primaryClasses);
    },
    [classFor, matchRoster, primarySignupsFor],
  );

  /** Raid-wide snapshot of who's actually going (primary assignments only, across all three roles) -- tank/healer/melee/ranged counts, plus which signups couldn't be bucketed into melee/ranged with confidence (see dpsRangeForSpec -- only signups with no spec recorded at all, on a class where that actually matters, land here now). */
  const compSummary = useMemo(() => {
    if (!selected) return null;
    const primaryTanks = primarySignupsFor(selected, 'tank');
    const primaryHealers = primarySignupsFor(selected, 'healer');
    const primaryDps = primarySignupsFor(selected, 'dps');

    let melee = 0;
    let ranged = 0;
    const ambiguous: string[] = [];
    for (const s of primaryDps) {
      const cls = classFor(s);
      if (!cls) continue;
      const range = dpsRangeForSpec(cls, specFor(s));
      if (range === 'melee') melee++;
      else if (range === 'ranged') ranged++;
      else ambiguous.push(s.characterName);
    }

    return { tanks: primaryTanks.length, healers: primaryHealers.length, dps: primaryDps.length, melee, ranged, ambiguous };
  }, [selected, primarySignupsFor, classFor, specFor]);

  /** Buff/utility coverage across everyone actually assigned primary, any role -- Bloodlust doesn't care whether it comes from a healer or a DPS. */
  const buffCoverage = useMemo(() => {
    if (!selected) return null;
    const allPrimary = (['tank', 'healer', 'dps'] as RaidRole[]).flatMap((r) => primarySignupsFor(selected, r));
    const classes = allPrimary.map(classFor).filter((c): c is string => !!c);
    return raidBuffCoverage(classes);
  }, [selected, primarySignupsFor, classFor]);

  const setAssignment = useCallback(
    (role: RaidRole, discordUserId: string, tier: AssignmentTier | null) => {
      if (!electron || !selected) return;
      const next: Record<RaidRole, RaidAssignment[]> = { tank: [...selected.assignments.tank], healer: [...selected.assignments.healer], dps: [...selected.assignments.dps] };
      next[role] = next[role].filter((a) => a.discordUserId !== discordUserId);
      if (tier) next[role].push({ discordUserId, tier });

      setPosts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, assignments: next } : p)));
      setSavingAssignments(true);
      setAssignmentError(null);
      electron
        .setRaidSignupAssignments(selected.id, next)
        .then((updated) => {
          if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        })
        .catch((err: Error) => {
          setAssignmentError(err.message || 'Could not save this assignment -- refresh before assuming it stuck.');
        })
        .finally(() => setSavingAssignments(false));
    },
    [electron, selected],
  );

  const finalize = useCallback(() => {
    if (!electron || !selected) return;
    setFinalizing(true);
    setFinalizeError(null);
    electron
      .finalizeRaidSignup(selected.id)
      .then((updated) => {
        if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      })
      .catch((err: Error) => {
        setFinalizeError(err.message || 'Could not post the final roster to Discord.');
      })
      .finally(() => setFinalizing(false));
  }, [electron, selected]);

  return {
    available: !!electron,
    posts,
    selected,
    setSelectedId,
    roles: ROLES,
    create,
    creating,
    createError,
    matchRoster,
    classFor,
    specFor,
    utilityFor,
    compSummary,
    buffCoverage,
    setAssignment,
    savingAssignments,
    assignmentError,
    finalize,
    finalizing,
    finalizeError,
  };
}
