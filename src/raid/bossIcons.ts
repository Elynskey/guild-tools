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

/** This tier's boss names, in the fixed order above -- reused wherever the app needs the full roster of bosses rather than just an icon (e.g. Settings' DPS-exclusion checklist). */
export const TIER_BOSS_NAMES: string[] = Object.keys(BOSS_CREATURE_DISPLAY_ID);

/** Boss portrait URL (Blizzard's public render CDN), or null for a boss not in this tier's reference. */
export function bossIconUrl(bossName: string): string | null {
  const id = BOSS_CREATURE_DISPLAY_ID[bossName];
  return id ? `https://render.worldofwarcraft.com/us/npcs/zoom/creature-display-${id}.jpg` : null;
}

export interface BossIconCrop {
  /** CSS background-size -- how much larger than its frame the image renders before being clipped. Higher = tighter zoom. */
  scale: number;
  /** CSS background-position -- which part of the (now-oversized) image stays visible. */
  position: string;
  /** CSS brightness() filter multiplier, for a render that's inherently very dark (not a crop problem -- no framing fixes a dark source image). Omit for no change (1). */
  brighten?: number;
}

// Every "zoom" render is a 600x600 square, but what's actually IN that square varies a
// lot per creature (confirmed by downloading and eyeballing all 9 for this tier) -- most
// have the head in the top ~15-20%, which the default crop (zoom in, anchor to the top)
// handles well. Three don't fit that pattern and get their own override:
//   - Ula'tek: a wide wingspan creature sitting vertically CENTERED in the frame (~35-70%
//     down) -- a top-anchored crop would show empty background and miss the creature
//     entirely.
//   - The Coiled Altar: the render itself is tiny (occupies maybe 15% of the square) and
//     centered around roughly (48%, 65%), not (50%, 50%) -- needs a much more aggressive
//     zoom than every other boss this tier, AND a position biased toward that specific
//     spot, to actually be visible at icon size.
//   - The Lost Explorers: not a framing problem at all -- the render itself is just very
//     dark (a deliberate mood-lit shot), so brightened rather than cropped differently.
//
// This is implemented as CSS background-image/background-size/background-position, not
// <img> object-fit/object-position -- object-fit only crops when the source and target
// aspect ratios actually differ, and forcing width/height to equal percentages (to zoom
// a square image within a square frame) makes them match by construction, silently
// making object-position a no-op regardless of its value. background-size handles a
// square-into-square zoom correctly.
const CROP_OVERRIDES: Record<string, BossIconCrop> = {
  "Ula'tek": { scale: 130, position: '50% 50%' },
  'The Coiled Altar': { scale: 600, position: '48% 65%' },
  'The Lost Explorers': { scale: 165, position: '50% 0%', brighten: 2.2 },
};
const DEFAULT_CROP: BossIconCrop = { scale: 165, position: '50% 0%' };

export function bossIconCrop(bossName: string): BossIconCrop {
  return CROP_OVERRIDES[bossName] ?? DEFAULT_CROP;
}
