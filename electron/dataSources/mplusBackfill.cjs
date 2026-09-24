const { slugifyRealm } = require('./raiderio.cjs');
const { recordSeasonRuns, lastBackfilledAt, runKey } = require('./mplusRunArchive.cjs');

// Fills the season archive with keys Raider.IO's profile lists no longer show.
// run-review's `pastRuns` lists a character's keys in one dungeon (confirmed live
// 2026-09-23: matched the season count exactly for most dungeons, capped at 12 per
// dungeon). No run URL, group or role in it, just time/level/timed/score --
// mplusRunArchive.cjs's runKey matches those back up with guildies' copies of the same key.
//
// One request per character per dungeon (~200 for this roster), so it runs in the
// background after a roster fetch, paced under Raider.IO's ~200/min limit, at most once a
// day per character. The next roster fetch picks up what it found.

const BASE = 'https://raider.io/api/v1';
const BACKFILL_EVERY_MS = 24 * 60 * 60 * 1000;
const PACE_MS = 700;

let running = false;

// Keystone chests: timed within par = 1, within 80% = 2, within 60% = 3.
function upgradesFor(clearTimeMs, parTimeMs) {
  if (!parTimeMs || clearTimeMs > parTimeMs) return 0;
  if (clearTimeMs <= parTimeMs * 0.6) return 3;
  if (clearTimeMs <= parTimeMs * 0.8) return 2;
  return 1;
}

function mapPastRun(past, ref) {
  const run = {
    dungeon: ref.dungeon,
    level: past.keyLevel,
    completedAt: past.completedAt,
    score: past.score ?? 0,
    upgrades: past.timed ? Math.max(1, upgradesFor(past.clearTimeMs, ref.parTimeMs)) : 0,
    iconUrl: ref.iconUrl ?? '',
    url: '',
    spec: null,
    role: null,
  };
  return { id: runKey(run), ...run };
}

async function fetchPastRuns(region, realm, name, ref) {
  const url =
    `${BASE}/client/run-review?region=${region}&realm=${slugifyRealm(realm)}&name=${encodeURIComponent(name)}` +
    `&dungeonId=${ref.zoneId}&keyLevel=${ref.level}&clearTimeMs=${ref.clearTimeMs}&completedAt=${encodeURIComponent(ref.completedAt)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Raider.IO run-review failed for ${name}-${realm} (${ref.dungeon}): ${res.status}`);
  const data = await res.json();
  return (data.pastRuns ?? []).map((p) => mapPastRun(p, ref));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Backfills every character due for it, one after another. Resolves when done; a
 * failed character is logged and retried on a later run (its backfilledAt isn't set).
 * @param {string} region
 * @param {{ key: string, name: string, realm: string, dungeonRefs: object[] }[]} characters from raiderio.cjs's fetchCharacterProfile
 * @param {{ now?: () => number, paceMs?: number, force?: boolean, logger?: Console }} [opts]
 */
async function backfillSeason(region, characters, { now = Date.now, paceMs = PACE_MS, force = false, logger = console } = {}) {
  let filled = 0;
  for (const c of characters) {
    const last = lastBackfilledAt(c.key);
    if (!force && last !== null && now() - last < BACKFILL_EVERY_MS) continue;
    if (!c.dungeonRefs?.length) continue;
    try {
      const runs = [];
      for (const ref of c.dungeonRefs) {
        runs.push(...(await fetchPastRuns(region, c.realm, c.name, ref)));
        await sleep(paceMs);
      }
      recordSeasonRuns([{ key: c.key, runs, backfilledAt: now() }]);
      filled++;
    } catch (err) {
      logger.warn(`[mplusBackfill] ${c.name}: ${err.message} -- will retry next time.`);
    }
  }
  if (filled) logger.log(`[mplusBackfill] Backfilled ${filled} character(s)' season keys.`);
  return filled;
}

/** Fire-and-forget from a roster fetch; never overlaps itself. */
function startSeasonBackfill(region, characters) {
  if (running) return;
  running = true;
  backfillSeason(region, characters)
    .catch((err) => console.error('[mplusBackfill] failed:', err))
    .finally(() => {
      running = false;
    });
}

module.exports = { backfillSeason, startSeasonBackfill, upgradesFor };
