import type { LootMonitorSnapshot } from '../electron';

/**
 * Judges every stage of the loot pipeline from one snapshot (what this PC saw, see main.cjs's
 * testTools:lootMonitor) plus what the shared store and the proxy know. Pure, so the rules that decide
 * "is the loot logger working?" are testable without WoW: a boss kill seen -> Need wins in the chat log ->
 * attributed -> saved by the addon -> in the store -> posted to Discord, with a check for each hand-off.
 *
 * Statuses: ok (working), warn (probably fine, look), fail (something is broken), idle (nothing to judge yet).
 */
export type CheckStatus = 'ok' | 'warn' | 'fail' | 'idle';
export type CheckGroup = 'Setup' | 'Capture' | 'Sync' | 'Output';

export interface HealthCheck {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail: string;
}

/** The bits of a shared-store record this needs (RawLootRecord plus what auto-post stamps on). */
export interface StoreRecordView {
  time: number; // unix seconds
  source?: 'chat-tail' | 'live';
  boss?: string | null;
  difficulty?: string | null;
  discordPostedAt?: string;
}

export interface HeartbeatView {
  /** Is this PC in the proxy's list of apps reporting in right now? */
  reporting: boolean;
  /** ...and does it say its chat log is being written? */
  chatLogActive: boolean;
}

/** The officer-wide settings that decide whether posts can happen at all. */
export interface ConfigView {
  autoPostLoot: boolean;
  testLootLogChannelId: string;
}

export interface PipelineHealth {
  checks: HealthCheck[];
  overall: CheckStatus;
}

const DIFFICULTY: Record<number, string> = { 1: 'Normal', 2: 'Heroic', 8: 'Mythic Keystone', 14: 'Normal', 15: 'Heroic', 16: 'Mythic', 17: 'Raid Finder', 23: 'Mythic', 208: 'Delves' };
export const difficultyName = (id: number) => DIFFICULTY[id] ?? `difficulty ${id}`;

/** "12s ago", "4m ago", "2h ago" */
export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

const WAIT_FOR_LOOT_MS = 3 * 60 * 1000; // rolls resolve within a minute or two of a kill
const STALE_PLACEHOLDER_MS = 10 * 60 * 1000;
const EXPECT_POSTED_MS = 2 * 60 * 1000;
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const isPlaceholder = (r: StoreRecordView) => r.source === 'chat-tail' || r.source === 'live';

export function evaluateLootPipeline(snap: LootMonitorSnapshot, store: StoreRecordView[] | null, heartbeat: HeartbeatView | null, config: ConfigView | null = null): PipelineHealth {
  const now = snap.now;
  const checks: HealthCheck[] = [];
  const add = (group: CheckGroup, id: string, label: string, status: CheckStatus, detail: string) => checks.push({ group, id, label, status, detail });

  const chatWins = snap.events.filter((e) => e.kind === 'chat-win');
  const enrich = snap.events.filter((e) => e.kind === 'enrich');
  const sessionStart = snap.sessionStartedAt;

  // ---- Setup ----
  add('Setup', 'wow', 'WoW folder found', snap.wow.valid ? 'ok' : 'fail', snap.wow.valid ? (snap.wow.resolved ?? '') : 'Guild Tools cannot find WoW, so nothing below can work. Set the folder on Loot History.');
  add('Setup', 'character', 'Character detected', snap.wow.characterName ? 'ok' : 'warn', snap.wow.characterName ? `${snap.wow.characterName} (from ${snap.wow.characterSource ?? 'unknown'})` : 'Your own wins ("You") cannot be matched to a name yet.');
  const addonDetail = `installed ${snap.addon.installed ?? 'none'}, this build carries ${snap.addon.bundled ?? '?'}`;
  add('Setup', 'addon', 'Test addon installed and current', snap.addon.status === 'current' ? 'ok' : snap.addon.status === 'outdated' ? 'warn' : 'fail', snap.addon.status === 'current' ? addonDetail : snap.addon.status === 'outdated' ? `${addonDetail}: press Update addon now on Loot History, then /reload.` : 'The addon is not installed (or WoW was not found).');

  if (!snap.chatLog.exists) add('Setup', 'chatlog', 'Chat log is being written', 'fail', 'No WoWChatLog.txt: chat logging has never been on for this install. In game: /gtloottest chatlog.');
  else if (snap.chatLog.active) add('Setup', 'chatlog', 'Chat log is being written', 'ok', `last line ${snap.chatLog.lastWriteAt ? ago(snap.chatLog.lastWriteAt, now) : 'recently'}`);
  else add('Setup', 'chatlog', 'Chat log is being written', 'warn', `last line ${snap.chatLog.lastWriteAt ? ago(snap.chatLog.lastWriteAt, now) : 'a long time ago'}: a quiet stretch, or logging is off. Say something in chat, or use Verify chat logging on Loot History.`);

  if (!snap.combatLog.exists) add('Setup', 'combatlog', 'Combat log is being written', 'warn', 'No combat log: boss kills cannot be seen, so wins cannot be attributed live (they still arrive after a /reload).');
  else add('Setup', 'combatlog', 'Combat log is being written', snap.combatLog.active ? 'ok' : 'warn', snap.combatLog.active ? 'writing' : 'Not written in the last 5 minutes: start combat logging (/combatlog) or the Warcraft Logs / Archon logger.');

  // The server side: can this PC reach the proxy, and is a test channel set for posts to land in?
  add('Setup', 'proxy', 'Loot store reachable (proxy)', store === null ? 'fail' : 'ok', store === null ? 'The proxy did not answer the loot store request: check the internet connection, or the proxy is down. Nothing can sync until it does.' : `${store.length} record(s) in the test store`);
  if (config) {
    add('Setup', 'test-channel', 'Test loot channel is set', config.testLootLogChannelId ? 'ok' : 'fail', config.testLootLogChannelId ? 'posts from this build go to the test Discord channel' : 'No test loot channel is set, so a test build can never post. Settings, "Test loot log channel".');
    add('Setup', 'auto-post', 'Auto-post is on', config.autoPostLoot ? 'ok' : 'warn', config.autoPostLoot ? 'confirmed wins post on their own' : 'Auto-post is off, so confirmed wins will not post (the Post to Discord button on Loot History still works). Turn it on in Settings.');
  }

  // ---- Capture ----
  const lastKill = snap.kills[0] ?? null;
  if (!lastKill) add('Capture', 'boss-kill', 'Boss kill seen', 'idle', 'No boss kill in the combat log yet this session.');
  else add('Capture', 'boss-kill', 'Boss kill seen', 'ok', `${lastKill.boss} (${difficultyName(lastKill.difficultyId)}) ${ago(lastKill.endedAt, now)}; ${snap.kills.length} kill(s) in the last 6h`);

  if (!lastKill) {
    add('Capture', 'loot-after-kill', 'Loot followed the kill', 'idle', 'Waiting for a boss kill.');
  } else {
    const winsAfter = chatWins.filter((e) => e.at >= lastKill.endedAt - 5000).length;
    const since = now - lastKill.endedAt;
    if (winsAfter > 0) add('Capture', 'loot-after-kill', 'Loot followed the kill', 'ok', `${winsAfter} Need win(s) seen in the chat log since ${lastKill.boss} died`);
    else if (since < WAIT_FOR_LOOT_MS) add('Capture', 'loot-after-kill', 'Loot followed the kill', 'idle', `${lastKill.boss} died ${ago(lastKill.endedAt, now)}: waiting for rolls.`);
    else add('Capture', 'loot-after-kill', 'Loot followed the kill', 'warn', `No Need win in the chat log since ${lastKill.boss} died ${ago(lastKill.endedAt, now)}. Fine if nobody rolled Need; if someone did, the chat log is not recording loot lines.`);
  }

  if (snap.session.capturedThisSession > 0) add('Capture', 'live-capture', 'Wins captured live from the chat log', 'ok', `${snap.session.capturedThisSession} this session${snap.session.lastCaptureAt ? `, last ${ago(snap.session.lastCaptureAt, now)}` : ''}`);
  else add('Capture', 'live-capture', 'Wins captured live from the chat log', 'idle', 'No Need win seen in the chat log yet this session.');

  const lastEnrich = enrich[enrich.length - 1];
  if (!lastEnrich) add('Capture', 'attribution', 'Wins attributed to a boss live', 'idle', 'No live win to attribute yet.');
  else if (lastEnrich.meta?.attributed) add('Capture', 'attribution', 'Wins attributed to a boss live', 'ok', lastEnrich.text);
  else add('Capture', 'attribution', 'Wins attributed to a boss live', 'warn', `${lastEnrich.text}. Expected outside this tier's raid; it waits for the addon's record after a /reload.`);

  // ---- Sync ----
  const addonSince = snap.addonData.recentWins.filter((w) => w.time * 1000 >= sessionStart - 5000).length;
  if (snap.addonData.status !== 'ok') add('Sync', 'addon-data', 'Addon saved its wins', 'warn', 'The app cannot read the test addon\'s saved data yet (it is written at /reload or logout).');
  else if (chatWins.length > addonSince) add('Sync', 'addon-data', 'Addon saved its wins', 'warn', `The chat log saw ${chatWins.length} win(s) this session but the addon's saved data has ${addonSince}: /reload to flush it (the addon only writes to disk on reload or logout).`);
  else if (addonSince > 0) add('Sync', 'addon-data', 'Addon saved its wins', 'ok', `${addonSince} win(s) this session in the addon's saved data (${snap.addonData.wins} in total)`);
  else add('Sync', 'addon-data', 'Addon saved its wins', 'idle', `${snap.addonData.wins} win(s) in total; none this session yet.`);

  if (store === null) {
    add('Sync', 'store', 'Wins reached the shared store', 'warn', 'Could not read the loot store from the proxy just now.');
  } else {
    const storeSince = store.filter((r) => r.time * 1000 >= sessionStart - 5000).length;
    if (chatWins.length > 0 && storeSince < chatWins.length) add('Sync', 'store', 'Wins reached the shared store', 'fail', `${chatWins.length} win(s) seen in the chat log but only ${storeSince} in the store: the push to the proxy is failing.`);
    else add('Sync', 'store', 'Wins reached the shared store', storeSince > 0 ? 'ok' : 'idle', storeSince > 0 ? `${storeSince} record(s) this session (${store.length} in the test store in total)` : `${store.length} record(s) in the test store; none this session yet.`);

    const stale = store.filter((r) => isPlaceholder(r) && now - r.time * 1000 > STALE_PLACEHOLDER_MS).length;
    add('Sync', 'verified', 'Wins confirmed by the addon', stale > 0 ? 'warn' : 'ok', stale > 0 ? `${stale} win(s) still unconfirmed after 10 minutes: they wait for the addon's record, which arrives after a /reload.` : 'No win is waiting on the addon.');
  }

  // ---- Output ----
  if (store === null) {
    add('Output', 'discord', 'Posted to the test Discord channel', 'idle', 'Store unavailable.');
  } else {
    const eligible = store.filter((r) => !isPlaceholder(r) && r.boss && r.difficulty && now - r.time * 1000 <= RECENT_WINDOW_MS);
    const posted = eligible.filter((r) => r.discordPostedAt).length;
    const overdue = eligible.filter((r) => !r.discordPostedAt && now - r.time * 1000 > EXPECT_POSTED_MS).length;
    if (eligible.length === 0) add('Output', 'discord', 'Posted to the test Discord channel', 'idle', 'No confirmed win with a boss and difficulty to post yet.');
    else if (overdue > 0) add('Output', 'discord', 'Posted to the test Discord channel', 'warn', `${overdue} confirmed win(s) not posted after 2 minutes. Check auto-post is on and a test loot channel is set in Settings.`);
    else add('Output', 'discord', 'Posted to the test Discord channel', 'ok', `${posted} of ${eligible.length} recent confirmed win(s) posted`);
  }

  if (heartbeat === null) add('Output', 'heartbeat', 'Proxy sees this PC reporting in', 'idle', 'Not checked yet.');
  else if (!heartbeat.reporting) add('Output', 'heartbeat', 'Proxy sees this PC reporting in', 'warn', 'The proxy has not heard from this app in the last 30 seconds.');
  else add('Output', 'heartbeat', 'Proxy sees this PC reporting in', heartbeat.chatLogActive ? 'ok' : 'warn', heartbeat.chatLogActive ? 'reporting, chat log active' : 'reporting, but its chat log reads as quiet');

  const statuses = checks.map((c) => c.status);
  const overall: CheckStatus = statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : statuses.includes('ok') ? 'ok' : 'idle';
  return { checks, overall };
}
