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
        role: member.role, // wowaudit's role is authoritative for the roster's raid assignment, not RIO's active spec
        class: rioData.class,
        spec: rioData.spec,
        rioCurrent: rioData.rioCurrent,
        rioHighestThisSeason: rioData.rioHighestThisSeason,
        ilvlEquipped: rioData.ilvlEquipped,
        ilvlHighestThisSeason: rioData.ilvlHighestThisSeason,
        gearCompletion: gearCompletion[member.name] ?? 0,
        perf: wclData.perf,
        parseTrend: wclData.parseTrend,
        deaths: wclData.deaths,
        pulls: wclData.pulls,
        nightParse: wclData.nightParse,
        nightDeaths: wclData.nightDeaths,
        nightPulls: wclData.nightPulls,
      };
    });
}

module.exports = { mergeSources };
