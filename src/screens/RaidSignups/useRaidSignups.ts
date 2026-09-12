import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssignmentTier, RaidAssignment, RaidRole, RaidSignupPost, TeamType } from '../../electron';
import { getRoster } from '../../data/rosterSource';
import type { Raider } from '../../scoring/types';
import { utilityGainedBy } from '../../raid/raidBuffs';

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

  /** Roster match (perf/class) for a signup's character name -- null if this character isn't on the roster (an alt, a typo, or someone new). */
  const matchRoster = useCallback((characterName: string) => rosterByName.get(characterName.toLowerCase()) ?? null, [rosterByName]);

  /** Utility this signup's class would add on top of whoever is already assigned primary in this role -- empty if their class brings nothing tracked, or nothing new. */
  const utilityFor = useCallback(
    (post: RaidSignupPost, role: RaidRole, characterName: string) => {
      const raider = matchRoster(characterName);
      if (!raider) return [];
      const primaryClasses = post.assignments[role]
        .filter((a) => a.tier === 'primary')
        .map((a) => post.signups.find((s) => s.discordUserId === a.discordUserId))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => matchRoster(s.characterName)?.class)
        .filter((c): c is string => !!c);
      return utilityGainedBy(raider.class, primaryClasses);
    },
    [matchRoster],
  );

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
    utilityFor,
    setAssignment,
    savingAssignments,
    assignmentError,
    finalize,
    finalizing,
    finalizeError,
  };
}
