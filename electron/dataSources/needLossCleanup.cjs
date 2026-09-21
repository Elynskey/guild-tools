// Finds lost-roll entries that are the SAME roll recorded twice, in a store that already has them.
//
// Why they exist: every officer's addon sees every roll in the raid, so each records its own copy, stamped with its own capture
// second. The store used to merge lost rolls only on an exact timestamp, so two officers' copies of one roll (a second or two
// apart) both stayed. Newer addons (1.7+) record the game's own drop ID, and the store now merges on that; this handles what is
// already there, which has no drop ID.
//
// The only thing that can make repeated (item, roller) entries legitimate is the item dropping more than once at the same boss:
// someone who rolled Need on both copies loses twice. So within a burst of repeats, the number of entries allowed is the number
// of copies that were won (a win record per copy), never fewer than one. Anything beyond that is a duplicate. Where a copy's
// win was never captured this can remove a real second loss, so callers show the plan before applying it.

const BURST_GAP_SECONDS = 120; // repeats of one (item, roller) closer than this belong to one burst

const needLossKey = (r) => `${r.itemId}::${r.name}::${r.time}`;

/**
 * @param {Array<object>} needLosses the store's lost rolls
 * @param {Array<object>} records the store's wins, to count how many copies of an item dropped
 * @returns {{ remove: object[], groups: Array<{ itemId: number, name: string, item: string | null, entries: number, copies: number, remove: number }> }}
 */
function planNeedLossCleanup(needLosses, records) {
  const winsByItem = new Map();
  for (const w of records ?? []) {
    if (w.itemId == null) continue;
    if (!winsByItem.has(w.itemId)) winsByItem.set(w.itemId, []);
    winsByItem.get(w.itemId).push(w.time);
  }

  // Entries that carry the game's drop ID are identified exactly (the store merges on it); only the legacy ones are judged here.
  const byPair = new Map();
  for (const l of needLosses ?? []) {
    if (l.lootListId != null && l.encounterId != null) continue;
    const key = `${l.itemId}::${l.name}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(l);
  }

  const remove = [];
  const groups = [];
  for (const entries of byPair.values()) {
    entries.sort((a, b) => a.time - b.time);
    let burst = [entries[0]];
    const flush = () => {
      if (burst.length > 1) {
        const first = burst[0].time;
        const last = burst[burst.length - 1].time;
        const copies = Math.max(1, (winsByItem.get(burst[0].itemId) ?? []).filter((t) => t >= first - BURST_GAP_SECONDS && t <= last + BURST_GAP_SECONDS).length);
        const excess = burst.length - copies;
        if (excess > 0) {
          const dropped = burst.slice(copies); // keep the earliest, remove the later ones
          remove.push(...dropped);
          groups.push({ itemId: burst[0].itemId, name: burst[0].name, item: itemName(burst[0].itemLink), entries: burst.length, copies, remove: dropped.length });
        }
      }
    };
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].time - burst[burst.length - 1].time <= BURST_GAP_SECONDS) burst.push(entries[i]);
      else {
        flush();
        burst = [entries[i]];
      }
    }
    flush();
  }
  return { remove, groups };
}

function itemName(itemLink) {
  const m = typeof itemLink === 'string' && itemLink.match(/\[(.+?)\]/);
  return m ? m[1] : null;
}

module.exports = { planNeedLossCleanup, needLossKey, BURST_GAP_SECONDS };
