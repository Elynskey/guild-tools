import type { LootMonitorSnapshot, LootRawFeeds } from '../electron';
import { ago, difficultyName, type ConfigView, type MonitorView, type PipelineHealth, type StoreRecordView } from './lootPipelineHealth';
import type { OfficerView } from './liveLootHealth';

const STATUS_WORD = { ok: 'OK', warn: 'LOOK', fail: 'BROKEN', idle: 'waiting' } as const;

const clock = (ms: number) => new Date(ms).toLocaleTimeString();

export interface DebugReportInput {
  appVersion: string;
  snapshot: LootMonitorSnapshot;
  health: PipelineHealth;
  feeds: LootRawFeeds | null;
  store: StoreRecordView[] | null;
  config: ConfigView | null;
  /** Which side of the Monitor this report is about. Default: the test pipeline. */
  view?: MonitorView;
  /** Live view only: the officers' apps the proxy currently hears from. */
  officers?: OfficerView[] | null;
}

/**
 * One block of plain text with everything needed to work out why the loot logger did (or didn't do) something,
 * built to be pasted into a message. No secrets: no keys, no tokens, no Discord IDs, only names of things and
 * what was seen. Pure, so its shape is tested.
 */
export function buildDebugReport({ appVersion, snapshot, health, feeds, store, config, view = 'test', officers = null }: DebugReportInput): string {
  const now = snapshot.now;
  const live = view === 'live';
  const out: string[] = [];
  out.push(`Guild Tools (Test) ${appVersion} -- ${live ? 'LIVE loot pipeline report (real guild, read-only)' : 'loot logger report (test pipeline)'}, ${new Date(now).toLocaleString()}`);
  out.push(`Overall: ${STATUS_WORD[health.overall]}`);
  out.push('');
  out.push('== Checks ==');
  for (const c of health.checks) out.push(`[${STATUS_WORD[c.status].padEnd(7)}] ${c.group}: ${c.label} -- ${c.detail}`);
  out.push('');
  out.push('== This PC ==');
  out.push(`WoW: ${snapshot.wow.valid ? 'found' : 'NOT FOUND'}; character: ${snapshot.wow.characterName ?? 'unknown'} (${snapshot.wow.characterSource ?? 'n/a'})`);
  out.push(`Addon: installed ${snapshot.addon.installed ?? 'none'}, bundled ${snapshot.addon.bundled ?? '?'}, ${snapshot.addon.status}`);
  out.push(`Chat log: ${snapshot.chatLog.exists ? `exists, last line ${snapshot.chatLog.lastWriteAt ? ago(snapshot.chatLog.lastWriteAt, now) : 'unknown'}, ${snapshot.chatLog.sizeBytes ?? '?'} bytes` : 'missing'}`);
  out.push(`Combat log: ${snapshot.combatLog.exists ? (snapshot.combatLog.active ? 'writing' : 'not written in 5 min') : 'missing'}`);
  out.push(`Live capture this session: ${snapshot.session.capturedThisSession} win(s); last poll ${snapshot.session.lastPollAt ? ago(snapshot.session.lastPollAt, now) : 'never'} (${snapshot.session.lastStatus ?? 'n/a'})`);
  out.push(`Addon saved data: ${snapshot.addonData.wins} win(s), ${snapshot.addonData.losses} lost roll(s), ${snapshot.addonData.trades} trade(s) [${snapshot.addonData.status}]`);
  if (config) out.push(`Settings: auto-post ${config.autoPostLoot ? 'on' : 'OFF'}; ${live ? 'loot' : 'test loot'} channel ${config.channelId ? 'set' : 'NOT SET'}`);
  if (store) {
    const placeholders = store.filter((r) => r.source === 'chat-tail' || r.source === 'live').length;
    out.push(`${live ? 'Live store' : 'Test store'}: ${store.length} record(s), ${placeholders} unconfirmed, ${store.filter((r) => r.discordPostedAt).length} posted`);
  } else {
    out.push(`${live ? 'Live store' : 'Test store'}: could not be read`);
  }
  if (live) out.push(`Officer apps reporting: ${officers === null ? 'not checked' : officers.length === 0 ? 'none' : officers.map((o) => `${o.officerName} (chat log ${o.chatLogActive ? 'on' : 'quiet'})`).join(', ')}`);
  out.push('');
  out.push('== Boss kills seen (newest first) ==');
  out.push(...(snapshot.kills.length ? snapshot.kills.map((k) => `${clock(k.endedAt)}  ${k.boss} (${difficultyName(k.difficultyId)})`) : ['none']));
  out.push('');
  out.push('== Timeline (newest first, last 40) ==');
  if (live) out.push("(not applicable in the Live view: this app's diary is about the test pipeline)");
  else out.push(...(snapshot.events.length ? [...snapshot.events].reverse().slice(0, 40).map((e) => `${clock(e.at)}  [${e.kind}] ${e.text}`) : ['nothing yet']));
  out.push('');
  out.push('== Loot lines WoW wrote to the chat log (newest first) ==');
  if (!feeds?.lootLines.available) out.push('(chat log not readable)');
  else out.push(...(feeds.lootLines.lines.length ? feeds.lootLines.lines.slice(0, 20).map((l) => `${l.time ?? '?'}  {${l.kind}}  ${l.text}`) : ['no loot lines in the recent chat log']));
  out.push('');
  out.push('== Boss pulls in the combat log (newest first) ==');
  if (!feeds?.pulls.available) out.push('(no combat log)');
  else out.push(...(feeds.pulls.pulls.length ? feeds.pulls.pulls.slice(0, 15).map((p) => `${clock(p.at)}  ${p.boss} (${difficultyName(p.difficultyId)})  ${p.kill ? 'KILL' : 'wipe'}`) : ['no boss pulls in the recent combat log']));
  return out.join('\n');
}
