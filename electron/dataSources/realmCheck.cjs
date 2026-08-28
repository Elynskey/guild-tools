// Cross-checks wowaudit's roster realm against Warcraft Logs' combat-log actor data
// (see warcraftlogs.cjs's fetchReportActorServers / observedRealms) -- catches the
// "Dunbarke" class of bug automatically: wowaudit had the wrong realm for a
// character, so every downstream fetch (Raider.IO, gear) silently pulled a
// different real person's data under the right name. WCL's actors come straight
// off the combat log, so they're independent of what any tracker claims.

// Not raiderio.cjs's slugifyRealm (spaces -> hyphens, for building Blizzard API
// slugs) -- confirmed live that WCL's masterData.actors `server` field strips
// spaces entirely ("The Scryers" -> "TheScryers", "Argent Dawn" -> "ArgentDawn"),
// so this strips whitespace instead of hyphenating it to compare the two formats
// on equal footing.
function normalizeRealm(realm) {
  return realm.toLowerCase().replace(/['\s-]/g, '');
}

/**
 * @param {Array<{ name: string, realm: string }>} wowauditRoster
 * @param {Record<string, string[]>} observedRealms — name -> realm(s) seen in this tier's reports
 * @returns {Array<{ name: string, wowauditRealm: string, observedRealms: string[] }>}
 */
function findRealmMismatches(wowauditRoster, observedRealms) {
  const mismatches = [];
  for (const member of wowauditRoster) {
    const seen = observedRealms[member.name];
    if (!seen || seen.length === 0) continue; // no raid log presence this tier -- nothing to cross-check yet

    const claimedSlug = normalizeRealm(member.realm);
    const matches = seen.some((realm) => normalizeRealm(realm) === claimedSlug);
    if (!matches) {
      mismatches.push({ name: member.name, wowauditRealm: member.realm, observedRealms: seen });
    }
  }
  return mismatches;
}

module.exports = { findRealmMismatches };
