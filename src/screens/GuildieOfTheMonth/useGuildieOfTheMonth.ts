import { useCallback, useEffect, useState } from 'react';
import type { GotmPost } from '../../electron';

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
    setSelectedId,
    create,
    creating,
    closeVoting,
    closing,
    announceWinner,
    announcing,
  };
}
