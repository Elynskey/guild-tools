import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GotmPost, GotmTallyEntry } from '../../electron';

/** Computed client-side from votes rather than trusted from the server -- not every
 * endpoint (e.g. the list route) attaches a pre-tallied `tally` field, so deriving it
 * here works no matter which endpoint the post came from. */
function tally(post: GotmPost): GotmTallyEntry[] {
  const counts = new Map<string, GotmTallyEntry>();
  for (const v of post.votes) {
    const current = counts.get(v.nomineeId) ?? { nomineeId: v.nomineeId, nomineeUsername: v.nomineeUsername, count: 0 };
    current.count += 1;
    current.nomineeUsername = v.nomineeUsername;
    counts.set(v.nomineeId, current);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function useGuildieOfTheMonth() {
  const electron = window.electronAPI;
  const [posts, setPosts] = useState<GotmPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [choosingTie, setChoosingTie] = useState(false);
  const [tieError, setTieError] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  const [announceError, setAnnounceError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!electron) return;
    electron.listGotmPosts().then((list) => {
      setPosts(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    });
  }, [electron]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = posts.find((p) => p.id === selectedId) ?? null;
  const selectedTally = useMemo(() => (selected ? tally(selected) : []), [selected]);

  /** Returns whether it succeeded so the "New" dialog can stay open and show the error on failure, instead of closing immediately and discarding it. */
  const create = useCallback(
    (openedBy: string | null, introText: string): Promise<boolean> => {
      if (!electron) return Promise.resolve(false);
      setCreating(true);
      setCreateError(null);
      return electron
        .createGotmPost(openedBy, introText)
        .then((post) => {
          setPosts((prev) => [post, ...prev]);
          setSelectedId(post.id);
          return true;
        })
        .catch((err: Error) => {
          setCreateError(err.message || 'Could not post this vote to Discord.');
          return false;
        })
        .finally(() => setCreating(false));
    },
    [electron],
  );

  const sendReminder = useCallback(
    (reminderText: string) => {
      if (!electron || !selected) return;
      setReminding(true);
      setRemindError(null);
      electron
        .remindGotmVoters(selected.id, reminderText)
        .catch((err: Error) => {
          setRemindError(err.message || 'Could not post the reminder to Discord.');
        })
        .finally(() => setReminding(false));
    },
    [electron, selected],
  );

  const closeVoting = useCallback(() => {
    if (!electron || !selected) return;
    setClosing(true);
    setCloseError(null);
    electron
      .closeGotmVoting(selected.id)
      .then((updated) => {
        if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      })
      .catch((err: Error) => {
        setCloseError(err.message || 'Could not close voting.');
      })
      .finally(() => setClosing(false));
  }, [electron, selected]);

  const chooseTieWinner = useCallback(
    (nomineeId: string) => {
      if (!electron || !selected) return;
      setChoosingTie(true);
      setTieError(null);
      electron
        .chooseGotmTieWinner(selected.id, nomineeId)
        .then((updated) => {
          if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        })
        .catch((err: Error) => {
          setTieError(err.message || 'Could not lock in the winner.');
        })
        .finally(() => setChoosingTie(false));
    },
    [electron, selected],
  );

  const announceWinner = useCallback(
    (winnerAnnounceText: string) => {
      if (!electron || !selected) return;
      setAnnouncing(true);
      setAnnounceError(null);
      electron
        .announceGotmWinner(selected.id, winnerAnnounceText)
        .then((updated) => {
          if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        })
        .catch((err: Error) => {
          setAnnounceError(err.message || 'Could not post the winner announcement to Discord.');
        })
        .finally(() => setAnnouncing(false));
    },
    [electron, selected],
  );

  return {
    available: !!electron,
    posts,
    selected,
    selectedTally,
    setSelectedId,
    create,
    creating,
    createError,
    sendReminder,
    reminding,
    remindError,
    closeVoting,
    closing,
    closeError,
    chooseTieWinner,
    choosingTie,
    tieError,
    announceWinner,
    announcing,
    announceError,
  };
}
