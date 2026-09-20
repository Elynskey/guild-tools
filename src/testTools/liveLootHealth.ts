import type { LootMonitorSnapshot } from '../electron';
import {
  EXPECT_POSTED_MS,
  RECENT_WINDOW_MS,
  STALE_PLACEHOLDER_MS,
  WAIT_FOR_LOOT_MS,
  ago,
  difficultyName,
  isPlaceholder,
  localSetupChecks,
  overallOf,
  type CheckGroup,
  type CheckStatus,
  type ConfigView,
  type HealthCheck,
  type PipelineHealth,
  type StoreRecordView,
} from './lootPipelineHealth';

/** One officer's app as the proxy last heard from it (the heartbeat list is shared by every build). */
export interface OfficerView {
  officerName: string;
  /** Chat log written to in the last 15 minutes (the proxy's sticky reading). */
  chatLogActive: boolean;
}

/**
 * The Live view of the Loot Logger Monitor: is the REAL guild's loot pipeline healthy? Everything here is read-only and
 * about the real store, the real channel and the real officers' apps. It cannot judge the hand-offs inside another
 * officer's PC (this app only sees its own files), so it judges what is observable from outside: who is covering chat
 * logging, whether wins followed the kills this PC saw, whether wins are stuck unconfirmed, whether they were posted.
 */
export function evaluateLiveLoot(snap: LootMonitorSnapshot, store: StoreRecordView[] | null, officers: OfficerView[] | null, config: ConfigView | null): PipelineHealth {
  const now = snap.now;
  const checks: HealthCheck[] = [...localSetupChecks(snap, 'live')];
  const add = (group: CheckGroup, id: string, label: string, status: CheckStatus, detail: string) => checks.push({ group, id, label, status, detail });

  // ---- Setup: the server side ----
  add('Setup', 'proxy', 'Live loot store reachable (proxy)', store === null ? 'fail' : 'ok', store === null ? 'The proxy did not answer the live loot store request: check the internet connection, or the proxy is down.' : `${store.length} record(s) in the real guild's loot log`);
  if (config) {
    add('Setup', 'channel', 'Loot log channel is set', config.channelId ? 'ok' : 'fail', config.channelId ? 'wins post to the real loot channel' : 'No loot log channel is set for the real guild, so nothing can post. Settings, "Loot log channel".');
    add('Setup', 'auto-post', 'Auto-post is on', config.autoPostLoot ? 'ok' : 'warn', config.autoPostLoot ? 'confirmed wins post on their own' : 'Auto-post is off for the real guild, so confirmed wins are not posting by themselves.');
  }

  // ---- Capture: who is covering, and did the kills this PC saw turn into wins ----
  if (officers === null) {
    add('Capture', 'coverage', 'Officers capturing loot', 'idle', 'Not checked yet.');
  } else if (officers.length === 0) {
    add('Capture', 'coverage', 'Officers capturing loot', 'warn', 'No officer\'s app has reported in recently, so nothing is capturing live loot. Wins still arrive after someone reloads with the addon.');
  } else {
    const logging = officers.filter((o) => o.chatLogActive);
    if (logging.length === 0) add('Capture', 'coverage', 'Officers capturing loot', 'warn', `${officers.length} officer app(s) are open (${officers.map((o) => o.officerName).join(', ')}) but none has chat logging on, so no live win can be captured.`);
    else add('Capture', 'coverage', 'Officers capturing loot', 'ok', `${logging.length} of ${officers.length} open app(s) have chat logging on: ${logging.map((o) => o.officerName).join(', ')}`);
  }

  const lastKill = snap.kills[0] ?? null;
  if (!lastKill) add('Capture', 'boss-kill', 'Boss kill seen on this PC', 'idle', 'No boss kill in this PC\'s combat log yet. Only meaningful while you are raiding on this PC.');
  else add('Capture', 'boss-kill', 'Boss kill seen on this PC', 'ok', `${lastKill.boss} (${difficultyName(lastKill.difficultyId)}) ${ago(lastKill.endedAt, now)}; ${snap.kills.length} kill(s) in the last 6h`);

  if (!lastKill) {
    add('Capture', 'loot-after-kill', 'Wins followed the kill', 'idle', 'Waiting for a boss kill on this PC.');
  } else if (store === null) {
    add('Capture', 'loot-after-kill', 'Wins followed the kill', 'idle', 'The live store could not be read.');
  } else {
    const winsAfter = store.filter((r) => r.time * 1000 >= lastKill.endedAt - 5000).length;
    const since = now - lastKill.endedAt;
    if (winsAfter > 0) add('Capture', 'loot-after-kill', 'Wins followed the kill', 'ok', `${winsAfter} win(s) reached the live store since ${lastKill.boss} died`);
    else if (since < WAIT_FOR_LOOT_MS) add('Capture', 'loot-after-kill', 'Wins followed the kill', 'idle', `${lastKill.boss} died ${ago(lastKill.endedAt, now)}: waiting for rolls.`);
    else add('Capture', 'loot-after-kill', 'Wins followed the kill', 'warn', `No win in the live store since ${lastKill.boss} died ${ago(lastKill.endedAt, now)}. Fine if nobody rolled Need; if someone did, no officer's app captured it (see who is covering above).`);
  }

  // ---- Sync ----
  if (snap.addonData.status !== 'ok') add('Sync', 'addon-data', 'This PC\'s addon data', 'idle', 'No readable GuildToolsLoot saved data on this PC. Fine if you do not raid from here.');
  else add('Sync', 'addon-data', 'This PC\'s addon data', snap.addonData.wins > 0 ? 'ok' : 'idle', `${snap.addonData.wins} win(s) and ${snap.addonData.losses} lost roll(s) in the saved data (written at /reload or logout)`);

  if (store === null) {
    add('Sync', 'store', 'Wins in the live store', 'warn', 'Could not read the live store just now.');
  } else {
    const recent = store.filter((r) => now - r.time * 1000 <= RECENT_WINDOW_MS);
    const newest = store.reduce((max, r) => Math.max(max, r.time), 0);
    add('Sync', 'store', 'Wins in the live store', recent.length > 0 ? 'ok' : 'idle', recent.length > 0 ? `${recent.length} in the last 6h, newest ${ago(newest * 1000, now)}; ${store.length} in total` : `${store.length} in total; none in the last 6h.`);
    const stale = store.filter((r) => isPlaceholder(r) && now - r.time * 1000 > STALE_PLACEHOLDER_MS && now - r.time * 1000 <= RECENT_WINDOW_MS).length;
    add('Sync', 'verified', 'Wins confirmed by the addon', stale > 0 ? 'warn' : 'ok', stale > 0 ? `${stale} recent win(s) still unconfirmed after 10 minutes: they wait for an officer's addon record, which arrives after that officer's /reload.` : 'No recent win is waiting on the addon.');
  }

  // ---- Output ----
  if (store === null) {
    add('Output', 'discord', 'Posted to the loot channel', 'idle', 'Store unavailable.');
  } else {
    const eligible = store.filter((r) => !isPlaceholder(r) && r.boss && r.difficulty && now - r.time * 1000 <= RECENT_WINDOW_MS);
    const posted = eligible.filter((r) => r.discordPostedAt).length;
    const overdue = eligible.filter((r) => !r.discordPostedAt && now - r.time * 1000 > EXPECT_POSTED_MS).length;
    if (eligible.length === 0) add('Output', 'discord', 'Posted to the loot channel', 'idle', 'No recent confirmed win with a boss and difficulty to post.');
    else if (overdue > 0) add('Output', 'discord', 'Posted to the loot channel', 'warn', `${overdue} confirmed win(s) not posted after 2 minutes. Check auto-post and the loot channel in Settings.`);
    else add('Output', 'discord', 'Posted to the loot channel', 'ok', `${posted} of ${eligible.length} recent confirmed win(s) posted`);
  }

  return { checks, overall: overallOf(checks) };
}
