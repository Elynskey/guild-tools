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
}

export interface RawTradeRecord {
  itemId: number | null;
  itemLink: string;
  from: string;
  to: string;
  time: number; // unix seconds
}

export interface LootEntry {
  /** Present for a real win record (editable/removable in the app); absent for a standalone trade, which has no single record to point at. */
  id?: string;
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
      entries.push({ itemId: trade.itemId, itemLink: trade.itemLink, winner: trade.from, boss: null, slot: null, time: trade.time, tradedTo: trade.to, standaloneTrade: true });
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

/** How many Need wins this raider has this raid night -- trading an item away afterward doesn't un-count it. */
export function needWinCount(entries: LootEntry[], name: string): number {
  return entries.filter((e) => e.winner === name && !e.standaloneTrade).length;
}
