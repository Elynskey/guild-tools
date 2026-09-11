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
  const [closing, setClosing] = useState(false);
  const [announcing, setAnnouncing] = useState(false);

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

  const create = useCallback(
    (openedBy: string | null, introText: string) => {
      if (!electron) return;
      setCreating(true);
      electron
        .createGotmPost(openedBy, introText)
        .then((post) => {
          setPosts((prev) => [post, ...prev]);
          setSelectedId(post.id);
        })
        .finally(() => setCreating(false));
    },
    [electron],
  );

  const closeVoting = useCallback(() => {
    if (!electron || !selected) return;
    setClosing(true);
    electron
      .closeGotmVoting(selected.id)
      .then((updated) => {
        if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      })
      .finally(() => setClosing(false));
  }, [electron, selected]);

  const announceWinner = useCallback(
    (winnerAnnounceText: string) => {
      if (!electron || !selected) return;
      setAnnouncing(true);
      electron
        .announceGotmWinner(selected.id, winnerAnnounceText)
        .then((updated) => {
          if (updated) setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
    closeVoting,
    closing,
    announceWinner,
    announcing,
  };
}
