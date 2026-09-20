import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LootMonitorSnapshot, LootRawFeeds } from '../electron';
import { buildDebugReport } from './debugReport';
import { evaluateLiveLoot, type OfficerView } from './liveLootHealth';
import { evaluateLootPipeline, type ConfigView, type HeartbeatView, type MonitorView, type PipelineHealth, type StoreRecordView } from './lootPipelineHealth';

const SNAPSHOT_EVERY_MS = 3_000;
const STORE_EVERY_MS = 10_000;
const FEEDS_EVERY_MS = 6_000;

/** What a one-click action is doing / did, shown next to its button. */
export type ActionState = { running: boolean; tone: 'success' | 'warning' | 'danger' | null; lines: string[] };
const IDLE: ActionState = { running: false, tone: null, lines: [] };

/**
 * Feeds the Loot Logger Monitor, for one of two views:
 *  - 'test': this build's own pipeline (the test addon, the TEST store, the test Discord channel). Reading the store goes
 *    through getLootLog(), which ALSO offers this PC's addon data to the TEST store, so the monitor keeps addon wins
 *    flowing while you watch. The write actions (fake win, clear) live here.
 *  - 'live': the real guild's pipeline, strictly read-only: the real store (read without offering anything to it), the
 *    real loot channel setting, the officers' apps the proxy hears from, and this PC's real addon. No write path exists
 *    in this view (the actions refuse to run in it).
 * Three clocks: the PC-local snapshot every 3s, the store and heartbeats every 10s, the raw feeds and settings every 6s.
 */
export function useLootMonitor(view: MonitorView) {
  const electron = window.electronAPI;
  const [snapshot, setSnapshot] = useState<LootMonitorSnapshot | null>(null);
  const [store, setStore] = useState<StoreRecordView[] | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatView | null>(null);
  const [officers, setOfficers] = useState<OfficerView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeCheckedAt, setStoreCheckedAt] = useState<number | null>(null);
  const [feeds, setFeeds] = useState<LootRawFeeds | null>(null);
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [synthetic, setSynthetic] = useState<ActionState>(IDLE);
  const [clearState, setClearState] = useState<ActionState>(IDLE);
  const [copyState, setCopyState] = useState<ActionState>(IDLE);
  const ownName = useRef<string | null>(null);
  // A reply that lands after the view was switched belongs to the other view: drop it.
  const viewRef = useRef(view);
  viewRef.current = view;

  // Switching view starts from a blank slate, so nothing from the other pipeline is ever shown under the wrong heading.
  useEffect(() => {
    setSnapshot(null);
    setStore(null);
    setStoreCheckedAt(null);
    setOfficers(null);
    setHeartbeat(null);
    setConfig(null);
    setError(null);
    setSynthetic(IDLE);
    setClearState(IDLE);
    setCopyState(IDLE);
  }, [view]);

  const loadSnapshot = useCallback(() => {
    if (!electron) return;
    electron
      .getLootMonitorSnapshot(view)
      .then((s) => {
        if (viewRef.current !== view) return;
        setSnapshot(s);
        setError(s === null ? 'This is not a test build, so there is nothing to monitor.' : null);
      })
      .catch((err: Error) => {
        if (viewRef.current === view) setError(err.message || 'Could not read the loot pipeline.');
      });
  }, [electron, view]);

  const loadStore = useCallback(() => {
    if (!electron) return;
    const read = view === 'live' ? electron.getLiveLootStore() : electron.getLootLog();
    void read
      .then((r) => {
        if (viewRef.current === view) setStore((r?.records ?? null) as StoreRecordView[] | null);
      })
      .catch(() => {
        if (viewRef.current === view) setStore(null);
      })
      .finally(() => {
        if (viewRef.current === view) setStoreCheckedAt(Date.now());
      });
    void Promise.all([electron.getLootCaptureHeartbeats(), ownName.current ? Promise.resolve(null) : electron.getAuthState()])
      .then(([beats, auth]) => {
        if (viewRef.current !== view) return;
        if (auth?.displayName) ownName.current = auth.displayName;
        const mine = beats.heartbeats.find((h) => h.officerName === ownName.current);
        setHeartbeat({ reporting: !!mine, chatLogActive: !!mine?.chatLogActive });
        setOfficers(beats.heartbeats.map((h) => ({ officerName: h.officerName, chatLogActive: h.chatLogActive })));
      })
      .catch(() => {
        if (viewRef.current !== view) return;
        setHeartbeat(null);
        setOfficers(null);
      });
  }, [electron, view]);

  const loadFeeds = useCallback(() => {
    if (!electron) return;
    electron.getLootRawFeeds().then(setFeeds).catch(() => setFeeds(null));
  }, [electron]);

  const loadConfig = useCallback(() => {
    if (!electron) return;
    electron
      .getSettings()
      .then((s) => {
        if (viewRef.current === view) setConfig({ autoPostLoot: s.autoPostLoot !== false, channelId: (view === 'live' ? s.lootLogChannelId : s.testLootLogChannelId) ?? '' });
      })
      .catch(() => {
        if (viewRef.current === view) setConfig(null);
      });
  }, [electron, view]);

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

  const health: PipelineHealth | null = useMemo(() => {
    if (!snapshot) return null;
    return view === 'live' ? evaluateLiveLoot(snapshot, store, officers, config) : evaluateLootPipeline(snapshot, store, heartbeat, config);
  }, [view, snapshot, store, heartbeat, officers, config]);

  /** One synthetic win through app -> proxy -> test store -> test Discord channel, with each step reported. Test view only. */
  const sendSyntheticWin = useCallback(async () => {
    if (!electron || view !== 'test') return;
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
  }, [electron, view, loadStore, loadSnapshot]);

  /** Empties the TEST loot store only. The caller confirms first. Test view only. */
  const clearTestLoot = useCallback(async () => {
    if (!electron || view !== 'test') return;
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
  }, [electron, view, loadStore]);

  /** Puts one paste-able block of everything the monitor knows on the clipboard. */
  const copyDebugReport = useCallback(async () => {
    if (!electron || !snapshot || !health) return;
    try {
      await electron.copyToClipboard(buildDebugReport({ appVersion: __APP_VERSION__, snapshot, health, feeds, store, config, view, officers }));
      setCopyState({ running: false, tone: 'success', lines: ['Copied. Paste it into a message.'] });
    } catch (err) {
      setCopyState({ running: false, tone: 'danger', lines: [(err as Error).message || 'Could not copy.'] });
    }
  }, [electron, snapshot, health, feeds, store, config, view, officers]);

  return {
    available: !!electron,
    view,
    snapshot,
    health,
    store,
    storeCheckedAt,
    feeds,
    config,
    officers,
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
