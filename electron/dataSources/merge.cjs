// Merges wowaudit (roster membership) + Raider.IO (score/ilvl) + Blizzard (gear
// completion) + Warcraft Logs (perf/deaths/trend) into the app's Raider[] shape
// (see src/scoring/types.ts).

function mergeSources({ wowauditRoster, rio, gearCompletion, wcl }) {
  return wowauditRoster
    .filter((member) => {
      const rioData = rio.find((r) => r.name === member.name);
      if (!rioData) {
        console.warn(`[merge] No Raider.IO data found for ${member.name} — omitting from this fetch.`);
        return false;
      }
      if (!wcl[member.name]) {
        // Already warned in warcraftlogs.cjs — this is the same "no logged history yet" case.
        return false;
      }
      return true;
    })
    .map((member) => {
      const rioData = rio.find((r) => r.name === member.name);
      const wclData = wcl[member.name];

      return {
        name: member.name,
        // wclData.role is the role WCL's own rankings show them actually playing
        // (resolved in warcraftlogs.cjs, newest report wins), falling back to
        // wowaudit's roster field only when WCL has no data for them -- confirmed
        // live to drift from wowaudit's static field (an off-spec tank night still
        // showing "dps" there), which put them in the wrong ledger section with a
        // score computed by the wrong formula. Not RIO's active spec either way --
        // that's just whatever spec they last logged into, not who they raid as.
        role: wclData.role,
        // Same reasoning as role, same source: WCL's own rankings carry the actual
        // class/spec played in the historical report being shown. Raider.IO's
        // class/spec is a live snapshot of whatever they're playing RIGHT NOW, which
        // can silently mismatch a past raid night after a respec (confirmed live:
        // RIO said "Havoc" days after a report where WCL showed "Vengeance" that
        // night -- "Havoc Demon Hunter · Tank" is a contradictory pairing no one
        // who knows the game would trust). RIO is the fallback only when WCL has no
        // rankings data for them at all this tier.
        class: wclData.class ?? rioData.class,
        spec: wclData.spec ?? rioData.spec,
        rioCurrent: rioData.rioCurrent,
        rioHighestThisSeason: rioData.rioHighestThisSeason,
        ilvlEquipped: rioData.ilvlEquipped,
        ilvlHighestThisSeason: rioData.ilvlHighestThisSeason,
        gearCompletion: gearCompletion[member.name] ?? 0,
        perf: wclData.perf,
        parseTrend: wclData.parseTrend,
        deaths: wclData.deaths,
        pulls: wclData.pulls,
        deathCauses: wclData.deathCauses,
        nightParse: wclData.nightParse,
        nightDeaths: wclData.nightDeaths,
        nightPulls: wclData.nightPulls,
        nightDeathCauses: wclData.nightDeathCauses,
      };
    });
}

module.exports = { mergeSources };
