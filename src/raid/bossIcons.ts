// Boss portrait icons -- creature_display IDs sourced from Blizzard's Journal API
// (journal-encounter's creatures[0].creature_display.id), fetched live 2026-08-28 for
// The Venomous Abyss + The Tidebound Grotto (Midnight Season 2, patch 12.1). Same
// hand-maintained-per-tier pattern as mechanicReference.cjs's BOSS_MECHANICS -- keys
// match WCL's real fight names exactly (confirmed against this guild's actual logs).
//
// Mechanic/ability icons were investigated the same way and are NOT available: every
// current-tier ability's spell ID (from journal-encounter's nested sections) 404s on
// Blizzard's /data/wow/media/spell/{id} endpoint (confirmed exhaustively, all 46
// abilities in mechanicReference.cjs, not a sampling fluke) -- these are internal
// encounter-script spells that were never given a real icon. Boss creature-display
// media, by contrast, resolved cleanly for all 9 bosses. Don't re-attempt mechanic
// icons via this endpoint without new evidence Blizzard's data has changed.
const BOSS_CREATURE_DISPLAY_ID: Record<string, number> = {
  'Vashnik the Malignant': 141675,
  "Nek'zali the Soulcoiler": 142077,
  'Entombed Sentinels': 143437,
  'The Lost Explorers': 143824,
  Sszorak: 142788,
  'The Twin Fangs': 140993,
  'The Coiled Altar': 142472,
  "Ula'tek": 140369,
  'Nymrissa Wavecaller': 137687,
};

/** Boss portrait URL (Blizzard's public render CDN), or null for a boss not in this tier's reference. */
export function bossIconUrl(bossName: string): string | null {
  const id = BOSS_CREATURE_DISPLAY_ID[bossName];
  return id ? `https://render.worldofwarcraft.com/us/npcs/zoom/creature-display-${id}.jpg` : null;
}
