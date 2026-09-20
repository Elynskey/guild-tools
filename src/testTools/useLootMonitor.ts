import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LootMonitorSnapshot } from '../electron';
import { evaluateLootPipeline, type HeartbeatView, type PipelineHealth, type StoreRecordView } from './lootPipelineHealth';

const SNAPSHOT_EVERY_MS = 3_000;
const STORE_EVERY_MS = 10_000;

/**
 * Feeds the Loot Logger Monitor. Two clocks: the PC-local snapshot (files, kills, the diary) every 3s, and the
 * shared store + proxy heartbeats every 10s. Reading the store goes through getLootLog(), which ALSO offers this PC's
 * addon data to the store, so the monitor is itself the thing that keeps addon wins flowing while you watch.
 */
export function useLootMonitor() {
  const electron = window.electronAPI;
  const [snapshot, setSnapshot] = useState<LootMonitorSnapshot | null>(null);
  const [store, setStore] = useState<StoreRecordView[] | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeCheckedAt, setStoreCheckedAt] = useState<number | null>(null);
  const ownName = useRef<string | null>(null);

  const loadSnapshot = useCallback(() => {
    if (!electron) return;
    electron
      .getLootMonitorSnapshot()
      .then((s) => {
        setSnapshot(s);
        setError(s === null ? 'This is not a test build, so there is nothing to monitor.' : null);
      })
      .catch((err: Error) => setError(err.message || 'Could not read the loot pipeline.'));
  }, [electron]);

  const loadStore = useCallback(() => {
    if (!electron) return;
    void electron
      .getLootLog()
      .then((r) => {
        setStore(r.records as StoreRecordView[]);
      })
      .catch(() => setStore(null))
      .finally(() => setStoreCheckedAt(Date.now()));
    void Promise.all([electron.getLootCaptureHeartbeats(), ownName.current ? Promise.resolve(null) : electron.getAuthState()])
      .then(([beats, auth]) => {
        if (auth?.displayName) ownName.current = auth.displayName;
        const mine = beats.heartbeats.find((h) => h.officerName === ownName.current);
        setHeartbeat({ reporting: !!mine, chatLogActive: !!mine?.chatLogActive });
      })
      .catch(() => setHeartbeat(null));
  }, [electron]);

  useEffect(() => {
    loadSnapshot();
    loadStore();
    const a = setInterval(loadSnapshot, SNAPSHOT_EVERY_MS);
    const b = setInterval(loadStore, STORE_EVERY_MS);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loadSnapshot, loadStore]);

  const health: PipelineHealth | null = useMemo(() => (snapshot ? evaluateLootPipeline(snapshot, store, heartbeat) : null), [snapshot, store, heartbeat]);

  return {
    available: !!electron,
    snapshot,
    health,
    store,
    storeCheckedAt,
    error,
    refresh: () => {
      loadSnapshot();
      loadStore();
    },
  };
}
