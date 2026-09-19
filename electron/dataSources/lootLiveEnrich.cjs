// Fills in what a chat-log Need win can't know on its own -- which item it really is,
// which slot, which boss dropped it and at what difficulty -- so it can be shown and
// auto-posted the moment it happens rather than after a /reload. Two real sources:
//   - the tier's boss loot table (bossLootTable.cjs: item name -> id/slot, and which
//     bosses drop which items), and
//   - a boss KILL just seen in the combat log (lootCombatLog.cjs: boss + difficulty).
// Two confidence levels, because the loot table is not complete (confirmed 2026-09-19
// against the real table and a real night's addon data: Ula'tek's Normal-mode drops were
// mostly missing from it):
//   1. The item IS in the table -> attributed only if it's a known drop of a boss that
//      was just killed. A known item that doesn't fit any recent kill is left alone.
//   2. The item is NOT in the table -> attributed to the most recent kill of one of THIS
//      TIER'S bosses (the table's boss list is the "this tier's raid" gate), but only if
//      that kill was within the last 5 minutes, and never for something named like a
//      recipe (the addon excludes recipes/toys/pets; this can't tell toys and pets apart,
//      so that gap is accepted).
// The kill itself must be a Normal or Heroic one. Anything that doesn't qualify is
// returned untouched and simply waits for the addon's authoritative record, exactly as
// before this existed.

const DIFFICULTY_LABEL = { 14: 'Normal', 15: 'Heroic' }; // Blizzard DifficultyIDs; LFR/Mythic aren't tracked
const UNKNOWN_ITEM_WINDOW_MS = 5 * 60 * 1000;
const RECIPE_NAME = /^(Recipe|Pattern|Schematic|Design|Formula|Technique|Plans|Manual|Blueprint):/i;

function itemNameOf(itemLink) {
  const m = typeof itemLink === 'string' && itemLink.match(/\[(.+)\]/);
  return m ? m[1] : null;
}

const lookupCache = new WeakMap();

function lookupsFor(lootTable) {
  let cached = lookupCache.get(lootTable);
  if (cached) return cached;
  const idByName = new Map();
  for (const [id, item] of Object.entries(lootTable.items ?? {})) if (!idByName.has(item.name)) idByName.set(item.name, Number(id));
  const tierBosses = new Set((lootTable.bosses ?? []).map((b) => b.name));
  const bossesByItemId = new Map();
  for (const [boss, ids] of Object.entries(lootTable.lootByBoss ?? {})) {
    for (const id of ids) {
      if (!bossesByItemId.has(id)) bossesByItemId.set(id, new Set());
      bossesByItemId.get(id).add(boss);
    }
  }
  cached = { idByName, bossesByItemId, tierBosses };
  lookupCache.set(lootTable, cached);
  return cached;
}

/**
 * @param {object} record a chat-tail win (itemId/boss/slot/difficulty all null)
 * @param {{ lootTable: object | null, kills: Array<{ boss: string, difficultyId: number }> }} ctx  kills newest first
 * @returns the record with its item resolved and -- when a matching recent kill exists -- boss, slot and difficulty filled in and `source: 'live'`
 */
function enrichWin(record, { lootTable, kills }) {
  if (!lootTable) return record;
  const { idByName, bossesByItemId, tierBosses } = lookupsFor(lootTable);
  const name = itemNameOf(record.itemLink);
  const itemId = name != null ? idByName.get(name) : undefined;

  if (itemId == null) {
    if (name == null || RECIPE_NAME.test(name)) return record;
    const winAt = record.time * 1000;
    const kill = kills.find((k) => tierBosses.has(k.boss) && DIFFICULTY_LABEL[k.difficultyId] && winAt - k.endedAt <= UNKNOWN_ITEM_WINDOW_MS);
    if (!kill) return record;
    // No item id or slot to offer -- the addon's own record fills those in when it syncs.
    return { ...record, boss: kill.boss, difficulty: DIFFICULTY_LABEL[kill.difficultyId], source: 'live' };
  }

  const withItem = { ...record, itemId };
  const candidates = bossesByItemId.get(itemId);
  if (!candidates || candidates.size === 0) return withItem;

  const kill = kills.find((k) => candidates.has(k.boss) && DIFFICULTY_LABEL[k.difficultyId]);
  if (!kill) return withItem;

  return { ...withItem, boss: kill.boss, slot: lootTable.items[itemId].slot ?? 'Other', difficulty: DIFFICULTY_LABEL[kill.difficultyId], source: 'live' };
}

module.exports = { enrichWin, DIFFICULTY_LABEL };
