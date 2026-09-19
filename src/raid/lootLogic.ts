export interface RawLootRecord {
  /** Assigned server-side on first sync (see lootRecordsStore.cjs), not by the addon -- lets an officer edit/remove one specific record. Optional since very old already-synced records may predate this. */
  id?: string;
  itemId: number | null;
  itemLink: string;
  winner: string;
  boss: string | null;
  /** Equip slot ("Head", "Trinket", ...), or "Other" for non-equippable. Optional -- records synced before this field existed won't have it. */
  slot?: string;
  time: number; // unix seconds
  /** Set only while this record has no boss/slot attribution yet -- captured live from WoW's chat log (lootChatTail.cjs) rather than the addon's SavedVariables, which is the only source that knows which boss a win came from. Cleared once the addon's own sync reconciles it (see lootRecordsStore.cjs's upgradeRecord). */
  source?: 'chat-tail' | 'live';
  /** "Normal" | "Heroic", or null/undefined for anything captured before this field existed, a manual entry with it unset, or a chat-tail placeholder (no client API access to determine it). The addon itself only ever captures Normal/Heroic -- Mythic and LFR are excluded at the source. */
  difficulty?: string | null;
}

/** A Need roll that did NOT win -- see recordNeedLoss in the addon. Deliberately its own shape, not a LootEntry variant: there's no winner/trade lifecycle to it, just "who rolled Need on what and lost." */
export interface RawNeedLossRecord {
  itemId: number | null;
  itemLink: string;
  name: string;
  boss: string | null;
  slot?: string;
  time: number; // unix seconds
  /** See RawLootRecord's `difficulty` -- same meaning, same caveats. */
  difficulty?: string | null;
}

export interface RawTradeRecord {
  /** Assigned server-side on first sync, same as RawLootRecord.id -- lets a standalone trade (no matching win record) be removed individually. Optional since very old already-synced trades may predate this. */
  id?: string;
  itemId: number | null;
  itemLink: string;
  from: string;
  to: string;
  time: number; // unix seconds
}

export interface LootEntry {
  /** Present for a real win record (editable/removable in the app); absent for a standalone trade, which has no single win record to point at -- see tradeId instead. */
  id?: string;
  /** Present only for a standalone trade (no matching win record) -- removable via that id, but has no other editable fields (a trade isn't a "win" the app can attribute a slot/boss to). */
  tradeId?: string;
  itemId: number | null;
  itemLink: string;
  /** The Need-roll winner, or (for a standalone unmatched trade) the trade's `from`. */
  winner: string;
  boss: string | null;
  /** Null for records synced before this field existed, and for standalone trades (trades don't carry slot). */
  slot: string | null;
  time: number;
  /** Set once a matching trade is found -- who the item ultimately went to. */
  tradedTo: string | null;
  /** True if this entry has no matching Need-win record -- the item was won before the addon was tracking, so only the trade half is known. */
  standaloneTrade: boolean;
  /** See RawLootRecord's `source` -- carried straight through by annotateWithTrades. */
  source?: 'chat-tail' | 'live';
  /** See RawLootRecord's `difficulty` -- null for records that predate it, and for standalone trades (a trade isn't a captured win, nothing to attribute a difficulty to). */
  difficulty?: string | null;
}

export interface LootNight {
  key: string;
  startTime: number;
  entries: LootEntry[];
}

// A BoP item stays trade-eligible for 2 hours after being looted -- a trade further
// out than that from the original win can't be the same item changing hands.
const TRADE_WINDOW_SECONDS = 2 * 60 * 60;

/** Matches each trade to the loot record it followed (same item, same original winner as the trade's `from`, within the BoP trade window) -- an unmatched trade becomes its own standalone entry rather than being dropped. */
export function annotateWithTrades(records: RawLootRecord[], trades: RawTradeRecord[]): LootEntry[] {
  const consumed = new Set<number>();
  const entries: LootEntry[] = records.map((r) => ({ ...r, slot: r.slot ?? null, tradedTo: null, standaloneTrade: false }));

  for (const trade of trades) {
    const match = entries.find(
      (e, i) =>
        !consumed.has(i) &&
        e.itemId != null &&
        e.itemId === trade.itemId &&
        e.winner === trade.from &&
        trade.time >= e.time &&
        trade.time - e.time <= TRADE_WINDOW_SECONDS,
    );
    if (match) {
      match.tradedTo = trade.to;
      consumed.add(entries.indexOf(match));
    } else {
      entries.push({ tradeId: trade.id, itemId: trade.itemId, itemLink: trade.itemLink, winner: trade.from, boss: null, slot: null, time: trade.time, tradedTo: trade.to, standaloneTrade: true });
    }
  }

  return entries.sort((a, b) => a.time - b.time);
}

// A gap of six-plus hours between consecutive loot events is treated as a new raid
// night -- there's no WCL report to key off here (unlike Pull Feedback), so grouping
// has to come from the timestamps themselves.
const NIGHT_GAP_SECONDS = 6 * 60 * 60;

/** Groups a time-sorted entry list into raid nights by gap detection, newest night first. */
export function groupLootByNight(entries: LootEntry[]): LootNight[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.time - b.time);
  const nights: LootNight[] = [];
  let current: LootEntry[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time - sorted[i - 1].time > NIGHT_GAP_SECONDS) {
      nights.push({ key: String(current[0].time), startTime: current[0].time, entries: current });
      current = [];
    }
    current.push(sorted[i]);
  }
  nights.push({ key: String(current[0].time), startTime: current[0].time, entries: current });

  return nights.reverse();
}

export function filterByRaider(entries: LootEntry[], name: string): LootEntry[] {
  return entries.filter((e) => e.winner === name || e.tradedTo === name);
}

/** How many Need wins this raider still has this raid night -- an item traded away afterward (accidental roll, wrong person won it) no longer counts against the original winner's cap. It doesn't count toward the recipient either -- they didn't Need-roll it, so it's excluded from cap-counting entirely, not reassigned. */
export function needWinCount(entries: LootEntry[], name: string): number {
  return entries.filter((e) => e.winner === name && !e.standaloneTrade && !e.tradedTo).length;
}

/** The guild's Need-win cap: 2 per raider per raid night, counted separately at each difficulty (2 on Normal and 1 on Heroic is fine). */
export const NEED_WIN_CAP = 2;

export interface NeedWinTally {
  /** Every Need win still counted this night (see needWinCount), all difficulties together. */
  total: number;
  /** What the cap judges: the most wins at any one difficulty. A win with no recorded difficulty (old data, or a capture the combat log hasn't matched yet) could belong to any of them, so it counts against the busiest known difficulty -- worst case, never a silent pass. */
  capCount: number;
  /** Wins per difficulty, in Normal/Heroic order; `difficulty` is null for wins with none recorded. */
  byDifficulty: { difficulty: string | null; count: number }[];
}

const DIFFICULTY_ORDER = ['Normal', 'Heroic'];

/** Need-win breakdown for this raider across the given entries (one raid night, normally) -- what the guild's cap is judged on. Same win-counting rule as needWinCount. */
export function needWinTally(entries: LootEntry[], name: string): NeedWinTally {
  const counts = new Map<string | null, number>();
  for (const e of entries) {
    if (e.winner !== name || e.standaloneTrade || e.tradedTo) continue;
    const key = e.difficulty ?? null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unknown = counts.get(null) ?? 0;
  const known = [...counts].filter(([d]) => d !== null) as [string, number][];
  const capCount = known.length ? Math.max(...known.map(([, n]) => n)) + unknown : unknown;
  const byDifficulty = [
    ...known.sort((a, b) => DIFFICULTY_ORDER.indexOf(a[0]) - DIFFICULTY_ORDER.indexOf(b[0])).map(([difficulty, count]) => ({ difficulty: difficulty as string | null, count })),
    ...(unknown ? [{ difficulty: null, count: unknown }] : []),
  ];
  return { total: known.reduce((sum, [, n]) => sum + n, 0) + unknown, capCount, byDifficulty };
}

/** Real item links are the |Hitem:...|h[Name]|h|r escape sequence -- pulls just the bracketed display name back out; sample/manual entries already store plain "[Name]" text, so this handles both the same way. */
export function itemLabel(link: string): string {
  const match = link.match(/\[(.+)\]/);
  return match ? match[1] : link;
}

export interface SeasonLootItem {
  itemLink: string;
  boss: string | null;
  slot: string | null;
  time: number;
  /** Set if this item was later traded away -- still counts toward totalWon, just not needWinCount (see needWinCount's own doc comment). */
  tradedTo: string | null;
  /** See RawLootRecord's `difficulty` -- same meaning, same caveats. */
  difficulty?: string | null;
}

export interface SeasonLootRow {
  name: string;
  /** Season-wide Need-win total, same rule as needWinCount -- excludes anything traded away. Informational only; NOT what the guild's cap judges (the cap is per raid night and per difficulty -- see maxNeedWinsInNight), so this can legitimately exceed 2 without ever breaching it. */
  needWinCount: number;
  /** Every item this raider was the original Need-roll winner of, this tier, regardless of whether they kept it -- the fuller picture behind needWinCount. */
  totalWon: number;
  /** Newest first. */
  items: SeasonLootItem[];
  /** Most recent win's timestamp, or null if they haven't won anything this tier -- what "who hasn't won anything in a while" sorts on. */
  lastWonAt: number | null;
  /** Highest Need-win count this raider hit at any single difficulty on any single raid night this tier -- what the guild's 2-win cap actually judges (see needWinTally, which Loot History's per-night chips use too). */
  maxNeedWinsInNight: number;
  /** How many Need rolls this raider lost this tier -- rolling and not winning, as distinct from just not rolling (which stays invisible, same as always). */
  lossCount: number;
  /** Newest first. Reuses SeasonLootItem's shape; tradedTo is always null since a losing roll was never won. */
  lostItems: SeasonLootItem[];
  /** A one-night visitor, not a raider: not on the roster, not a guild character, and only ever seen in loot on a single raid night (a pug or a guest in the group). Hidden from the season report by default. Always false when no guild list was available to judge by. */
  isGuest: boolean;
}

/** How many separate raid nights a set of timestamps spans -- a gap of more than the same 6 hours that groups loot into a night starts a new one. */
export function countRaidNights(times: number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  let nights = 1;
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > NIGHT_GAP_SECONDS) nights++;
  return nights;
}

/**
 * Season-wide "who's won what" -- one row per raider, seeded from the full roster so
 * someone with zero wins still shows up (the whole point of a report meant to surface
 * who's behind), plus anyone who's won something but isn't on the current roster
 * snapshot (an alt, a since-departed member -- their history doesn't just disappear).
 * Pure function over the full season's entries, same as everything else in this file;
 * the "season" scope comes from the caller passing every entry (not one night's).
 *
 * Group loot also captures whoever else was in the raid group -- a one-off pug or guest
 * run puts dozens of non-guild names in the data. `guildNames` (every guild character we
 * know of) lets those be marked `isGuest` instead of listed as raiders: someone is a
 * guest only if they are on neither the roster nor the guild list AND were seen on a
 * single raid night. Anyone who raided with the team on 2+ nights stays (a raider who has
 * since left or gone inactive keeps their history). Pass null when the guild list isn't
 * available: nobody is judged a guest, so a missing list can never hide a real raider.
 */
export function buildSeasonLootReport(entries: LootEntry[], rosterNames: string[], lossRecords: RawNeedLossRecord[] = [], guildNames: ReadonlySet<string> | null = null): SeasonLootRow[] {
  const byName = new Map<string, LootEntry[]>();
  for (const name of rosterNames) byName.set(name, []);
  for (const e of entries) {
    if (e.standaloneTrade) continue; // no real winner to attribute -- e.winner is just the trade's `from`, not a Need roll
    const list = byName.get(e.winner) ?? [];
    list.push(e);
    byName.set(e.winner, list);
  }

  const lossesByName = new Map<string, RawNeedLossRecord[]>();
  for (const name of rosterNames) lossesByName.set(name, []);
  for (const r of lossRecords) {
    const list = lossesByName.get(r.name) ?? [];
    list.push(r);
    lossesByName.set(r.name, list);
  }

  const rosterSet = new Set(rosterNames);
  const nights = groupLootByNight(entries);
  const allNames = new Set([...byName.keys(), ...lossesByName.keys()]);

  return [...allNames].map((name) => {
    const won = byName.get(name) ?? [];
    const sorted = [...won].sort((a, b) => b.time - a.time);
    const maxNeedWinsInNight = nights.reduce((max, night) => Math.max(max, needWinTally(night.entries, name).capCount), 0);
    const losses = [...(lossesByName.get(name) ?? [])].sort((a, b) => b.time - a.time);
    const isGuest = guildNames !== null && !rosterSet.has(name) && !guildNames.has(name) && countRaidNights([...won.map((e) => e.time), ...losses.map((r) => r.time)]) < 2;
    return {
      name,
      needWinCount: needWinCount(entries, name),
      totalWon: won.length,
      items: sorted.map((e) => ({ itemLink: e.itemLink, boss: e.boss, slot: e.slot, time: e.time, tradedTo: e.tradedTo, difficulty: e.difficulty })),
      lastWonAt: sorted[0]?.time ?? null,
      maxNeedWinsInNight,
      lossCount: losses.length,
      lostItems: losses.map((r) => ({ itemLink: r.itemLink, boss: r.boss, slot: r.slot ?? null, time: r.time, tradedTo: null, difficulty: r.difficulty })),
      isGuest,
    };
  });
}

const NO_BOSS_LABEL = 'No boss recorded';

/**
 * One Discord message per boss (per difficulty -- see below) for an officer's manual
 * "Post to Discord" -- winner + item (+ slot, + where it ended up if traded), headed by
 * the boss name. Entries with no boss (an old capture from before boss attribution was
 * fixed, or a standalone trade -- see annotateWithTrades, which never gives those a
 * boss) are grouped under one shared heading instead of being silently dropped from the
 * post.
 *
 * Grouped by boss+difficulty, not boss alone, so a boss killed on both Normal and
 * Heroic within the same grouped night (e.g. an Alt run and a Heroic run close enough
 * together to fall in one 6-hour window) gets separate headings instead of merging two
 * different difficulties' loot under one boss name with no way to tell them apart.
 */
export function formatNightForDiscord(entries: LootEntry[]): string[] {
  const byBossAndDifficulty = new Map<string, LootEntry[]>();
  for (const e of entries) {
    const key = `${e.boss ?? NO_BOSS_LABEL}||${e.difficulty ?? ''}`;
    const list = byBossAndDifficulty.get(key) ?? [];
    list.push(e);
    byBossAndDifficulty.set(key, list);
  }

  const formatLine = (e: LootEntry): string => {
    const item = itemLabel(e.itemLink);
    if (e.standaloneTrade) return `🔄 ${e.winner}'s ${item} → traded to ${e.tradedTo}`;
    const slot = e.slot ? ` (${e.slot})` : '';
    const trade = e.tradedTo ? ` → traded to ${e.tradedTo}` : '';
    return `🎲 ${e.winner} won ${item}${slot}${trade}`;
  };

  return [...byBossAndDifficulty.values()].map((bossEntries) => {
    const boss = bossEntries[0].boss ?? NO_BOSS_LABEL;
    const difficulty = bossEntries[0].difficulty;
    const heading = difficulty ? `${boss} (${difficulty})` : boss;
    return `**${heading}**\n${bossEntries.map(formatLine).join('\n')}`;
  });
}
