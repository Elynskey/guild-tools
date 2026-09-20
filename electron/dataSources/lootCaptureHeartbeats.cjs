// Proxy-side aggregation of "which officers' Guild Tools apps are currently tailing an
// active chat log" -- answers "is at least one person actually capturing loot live
// right now" without everyone having to compare notes mid-raid. Only meaningful on the
// shared proxy (where every officer's app reports in) -- the packaged app's local
// fallback has no other officers to aggregate, so it never calls this at all.
//
// Deliberately in-memory only, not persisted to loot-records.json or any file: a
// heartbeat older than STALE_MS is worthless (that officer's app may have closed, or
// WoW may not even be running), so there's nothing worth surviving a proxy restart for
// -- every live instance re-reports within one poll interval regardless. Same
// "ephemeral is fine here" reasoning as why this isn't mode-isolated like
// analyticsStore -- prod/test have separate Discord config but there's no real harm in
// a test-mode build's heartbeat showing up alongside prod's; this never touches guild
// data or posts anywhere.

const STALE_MS = 30 * 1000; // 3x the app's own 10s poll interval -- tolerates one missed beat, treats two as gone.

// An app reports "active" only while its chat log was written to within the last 5 minutes,
// so an officer whose logging is genuinely on flips to "off" during any quiet stretch (no
// chat for 5+ minutes is normal between pulls) and back on at the next line -- seen live
// 2026-09-19, when two officers read on at 7:46 PM and off again at 7:56 PM with nothing
// having changed. So the coverage answer treats an officer as logging if their app has
// reported active at any point in the last RECENT_ACTIVE_MS. The trade-off is deliberate:
// someone who logs out stays "on" for up to that long, in exchange for the raid not looking
// uncovered every time chat goes quiet. The raw reading is still returned as `writingNow`.
const RECENT_ACTIVE_MS = 15 * 60 * 1000;
const heartbeats = new Map(); // officerName -> { writingNow: boolean, lastActiveAt: number | null, lastSeenAt: number }

function recordHeartbeat(officerName, chatLogActive) {
  if (!officerName) return;
  const now = Date.now();
  const previous = heartbeats.get(officerName);
  heartbeats.set(officerName, {
    writingNow: !!chatLogActive,
    lastActiveAt: chatLogActive ? now : (previous?.lastActiveAt ?? null),
    lastSeenAt: now,
  });
}

// Prunes stale entries as a side effect of listing rather than on a separate timer --
// this only ever gets called by the same officers whose freshness it's checking, so
// there's no risk of the map growing unbounded between calls.
function listActiveHeartbeats() {
  const now = Date.now();
  const result = [];
  for (const [officerName, entry] of heartbeats) {
    if (now - entry.lastSeenAt > STALE_MS) {
      heartbeats.delete(officerName);
      continue;
    }
    const recentlyActive = entry.lastActiveAt !== null && now - entry.lastActiveAt <= RECENT_ACTIVE_MS;
    result.push({ officerName, chatLogActive: entry.writingNow || recentlyActive, writingNow: entry.writingNow, lastActiveAt: entry.lastActiveAt, lastSeenAt: entry.lastSeenAt });
  }
  return result;
}

module.exports = { recordHeartbeat, listActiveHeartbeats, RECENT_ACTIVE_MS };
