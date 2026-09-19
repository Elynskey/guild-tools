import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssignmentTier, RaidAssignment, RaidRole, RaidSignupEntry, RaidSignupPost, TeamType } from '../../electron';
import { getRoster } from '../../data/rosterSource';
import type { Raider } from '../../scoring/types';
import { utilityGainedBy, raidBuffCoverage, dpsRangeForSpecs } from '../../raid/raidBuffs';
import { createAssignmentSaver } from './assignmentSaver';
import { moveBackup as moveBackupIn } from './backupOrder';

const ROLES: RaidRole[] = ['tank', 'healer', 'dps'];
type Assignments = Record<RaidRole, RaidAssignment[]>;

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

  // Serializes assignment saves and keeps the latest intended state -- see assignmentSaver.ts
  // for the lost-click bug this replaces.
  const saver = useMemo(
    () =>
      createAssignmentSaver<Assignments, RaidSignupPost>({
        send: (postId, assignments) => (electron ? electron.setRaidSignupAssignments(postId, assignments) : Promise.resolve(null)),
        onSaved: (updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p))),
        onError: (err) => setAssignmentError(err.message || 'Could not save this assignment -- refresh before assuming it stuck.'),
        onBusy: setSavingAssignments,
      }),
    [electron],
  );

  const refresh = useCallback(() => {
    if (!electron) return;
    electron.listRaidSignups().then((list) => {
      saver.reset(); // the server's copy is the truth again (ignored if a save is still in flight)
      setPosts(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    });
  }, [electron, saver]);

  useEffect(() => {
    refresh();
    void getRoster().then((r) => setRoster(r.raiders));
  }, [refresh]);

  const selected = posts.find((p) => p.id === selectedId) ?? null;

  /** Returns whether it succeeded so the "New" dialog can stay open and show the error on failure, instead of closing immediately and discarding it. */
  const create = useCallback(
    (raidName: string, teamType: TeamType, signupText: string, channelId: string): Promise<boolean> => {
      if (!electron) return Promise.resolve(false);
      setCreating(true);
      setCreateError(null);
      return electron
        .createRaidSignup(raidName, teamType, signupText, channelId || undefined)
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

  /** Spec(s) for a signup -- self-reported alongside class, null for signups made before that field existed (no roster fallback: the roster doesn't track "spec(s) they signed up to raid as," only whatever they're playing right now). Can be more than one spec of the same role. */
  const specsFor = useCallback((signup: RaidSignupEntry) => signup.specs ?? null, []);

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

  /** Raid-wide snapshot of who's actually going (primary assignments only, across all three roles) -- tank/healer/melee/ranged counts, plus which signups couldn't be bucketed into melee/ranged with confidence (see dpsRangeForSpecs -- covers no spec recorded at all, or multiple specs picked that don't agree on melee/ranged). */
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
      const range = dpsRangeForSpecs(cls, specsFor(s));
      if (range === 'melee') melee++;
      else if (range === 'ranged') ranged++;
      else ambiguous.push(s.characterName);
    }

    return { tanks: primaryTanks.length, healers: primaryHealers.length, dps: primaryDps.length, melee, ranged, ambiguous };
  }, [selected, primarySignupsFor, classFor, specsFor]);

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
      setAssignmentError(null);
      const next = saver.edit(selected.id, selected.assignments, (current) => {
        const updated: Assignments = { tank: [...current.tank], healer: [...current.healer], dps: [...current.dps] };
        updated[role] = updated[role].filter((a) => a.discordUserId !== discordUserId);
        if (tier) updated[role].push({ discordUserId, tier });
        return updated;
      });
      setPosts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, assignments: next } : p)));
    },
    [electron, selected, saver],
  );

  /** Moves a backup one place earlier/later in the call-up order for this role. */
  const moveBackup = useCallback(
    (role: RaidRole, discordUserId: string, direction: 'up' | 'down') => {
      if (!electron || !selected) return;
      setAssignmentError(null);
      const next = saver.edit(selected.id, selected.assignments, (current) => ({ ...current, [role]: moveBackupIn(current[role], discordUserId, direction) }));
      setPosts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, assignments: next } : p)));
    },
    [electron, selected, saver],
  );

  const finalize = useCallback(() => {
    if (!electron || !selected) return;
    setFinalizing(true);
    setFinalizeError(null);
    // The final roster is built on the server from whatever assignments it has stored, so
    // every pending save has to land first -- and if one failed, posting would announce a
    // roster missing recent changes, so stop and say so instead.
    saver
      .flush()
      .then(() => {
        if (saver.hasFailed()) throw new Error("A recent assignment change didn't save -- refresh and check the assignments before posting the final roster.");
        return electron.finalizeRaidSignup(selected.id);
      })
      .then((updated) => {
        if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      })
      .catch((err: Error) => {
        setFinalizeError(err.message || 'Could not post the final roster to Discord.');
      })
      .finally(() => setFinalizing(false));
  }, [electron, selected, saver]);

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
    specsFor,
    utilityFor,
    compSummary,
    buffCoverage,
    setAssignment,
    moveBackup,
    savingAssignments,
    assignmentError,
    finalize,
    finalizing,
    finalizeError,
  };
}
