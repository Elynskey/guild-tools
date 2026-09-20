import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LootMonitorSnapshot, LootRawFeeds } from '../electron';
import { buildDebugReport } from './debugReport';
import { evaluateLootPipeline, type ConfigView, type HeartbeatView, type PipelineHealth, type StoreRecordView } from './lootPipelineHealth';

const SNAPSHOT_EVERY_MS = 3_000;
const STORE_EVERY_MS = 10_000;
const FEEDS_EVERY_MS = 6_000;

/** What a one-click action is doing / did, shown next to its button. */
export type ActionState = { running: boolean; tone: 'success' | 'warning' | 'danger' | null; lines: string[] };
const IDLE: ActionState = { running: false, tone: null, lines: [] };

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
  const [feeds, setFeeds] = useState<LootRawFeeds | null>(null);
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [synthetic, setSynthetic] = useState<ActionState>(IDLE);
  const [clearState, setClearState] = useState<ActionState>(IDLE);
  const [copyState, setCopyState] = useState<ActionState>(IDLE);
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

  const loadFeeds = useCallback(() => {
    if (!electron) return;
    electron.getLootRawFeeds().then(setFeeds).catch(() => setFeeds(null));
  }, [electron]);

  const loadConfig = useCallback(() => {
    if (!electron) return;
    electron
      .getSettings()
      .then((s) => setConfig({ autoPostLoot: s.autoPostLoot !== false, testLootLogChannelId: s.testLootLogChannelId ?? '' }))
      .catch(() => setConfig(null));
  }, [electron]);

  useEffect(() => {
    loadSnapshot();
    loadStore();
    loadFeeds();
    loadConfig();
    const a = setInterval(loadSnapshot, SNAPSHOT_EVERY_MS);
    const b = setInterval(loadStore, STORE_EVERY_MS);
    const c = setInterval(() => {
      loadFeeds();
      loadConfig();
    }, FEEDS_EVERY_MS);
    return () => {
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
    };
  }, [loadSnapshot, loadStore, loadFeeds, loadConfig]);

  const health: PipelineHealth | null = useMemo(() => (snapshot ? evaluateLootPipeline(snapshot, store, heartbeat, config) : null), [snapshot, store, heartbeat, config]);

  /** One synthetic win through app -> proxy -> test store -> test Discord channel, with each step reported. */
  const sendSyntheticWin = useCallback(async () => {
    if (!electron) return;
    setSynthetic({ running: true, tone: null, lines: ['Sending a fake win through the pipeline (up to 15 seconds)…'] });
    try {
      const r = await electron.injectTestWin();
      if (!r.ok) {
        setSynthetic({ running: false, tone: 'danger', lines: [r.error ?? 'Failed.'] });
      } else {
        const lines = [
          `${r.winner} won a fake item on "Pipeline Test Boss" (Heroic).`,
          r.stored ? 'PASS: it reached the shared test store.' : 'FAIL: it never showed up in the shared test store.',
          r.posted ? 'PASS: it was posted to the test Discord channel.' : 'FAIL: it was not posted to the test Discord channel (is auto-post on and a test channel set?).',
          ...(r.steps ?? []),
        ];
        setSynthetic({ running: false, tone: r.stored && r.posted ? 'success' : 'danger', lines });
      }
    } catch (err) {
      setSynthetic({ running: false, tone: 'danger', lines: [(err as Error).message || 'Failed.'] });
    }
    loadStore();
    loadSnapshot();
  }, [electron, loadStore, loadSnapshot]);

  /** Empties the TEST loot store only. The caller confirms first. */
  const clearTestLoot = useCallback(async () => {
    if (!electron) return;
    setClearState({ running: true, tone: null, lines: ['Clearing the test loot log…'] });
    try {
      const r = await electron.clearTestLoot();
      setClearState(
        r.ok
          ? { running: false, tone: 'success', lines: [`Cleared the TEST loot log${r.removed ? ` (${r.removed.records} record(s))` : ''}. The real one was not touched.`] }
          : { running: false, tone: 'danger', lines: [r.error ?? 'Failed.'] },
      );
    } catch (err) {
      setClearState({ running: false, tone: 'danger', lines: [(err as Error).message || 'Failed.'] });
    }
    loadStore();
  }, [electron, loadStore]);

  /** Puts one paste-able block of everything the monitor knows on the clipboard. */
  const copyDebugReport = useCallback(async () => {
    if (!electron || !snapshot || !health) return;
    try {
      await electron.copyToClipboard(buildDebugReport({ appVersion: __APP_VERSION__, snapshot, health, feeds, store, config }));
      setCopyState({ running: false, tone: 'success', lines: ['Copied. Paste it into a message.'] });
    } catch (err) {
      setCopyState({ running: false, tone: 'danger', lines: [(err as Error).message || 'Could not copy.'] });
    }
  }, [electron, snapshot, health, feeds, store, config]);

  return {
    available: !!electron,
    snapshot,
    health,
    store,
    storeCheckedAt,
    feeds,
    config,
    error,
    synthetic,
    clearState,
    copyState,
    sendSyntheticWin,
    clearTestLoot,
    copyDebugReport,
    refresh: () => {
      loadSnapshot();
      loadStore();
      loadFeeds();
      loadConfig();
    },
  };
}
