import type { Gates, Window } from './scoring/types';

/**
 * Season/monthly-editable configuration. See SEASON-UPDATE.md in the project root
 * for the cadence each field is meant to be edited on.
 */
export const config = {
  // --- Every season (start of a new raid tier) ---
  // ilvl/rio are the guild's real current-tier minimums (not the design bundle's fictional 690/1000 placeholders).
  gates: { rio: 1000, ilvl: 285, green: 75, yellow: 55 } satisfies Gates,
  defaultWindow: 'rolled' as Window,
  tier: {
    name: 'The Venomous Abyss',
    progressionDifficulty: 'Heroic',
    // Total boss count is genuinely static per tier (Blizzard's fixed raid design) —
    // the KILLED count, however, is now computed live from real Warcraft Logs kill
    // data (electron/dataSources/warcraftlogs.cjs), not hardcoded. This is only the
    // denominator, and the fallback numerator used in sample-data mode.
    totalBosses: 8,
    sampleModeKilled: 3,
  },
  kills: [
    { image: './assets/site/kill-sentinels.png', alt: 'Sentinels defeated', caption: 'Sentinels · first Heroic kill' },
    { image: './assets/site/kill-vashnik.png', alt: 'Vashnik defeated', caption: 'Vashnik · Saturday Heroic' },
    { image: './assets/site/kill-rotmire.png', alt: 'Rotmire defeated', caption: 'Rotmire · two pulls, no deaths' },
  ],

  // --- Only when the expansion changes ---
  expansionLogo: './assets/site/midnight-logo.avif',
  heroBanner: './assets/site/hero-banner.jpg',

  // --- Monthly ---
  enchantReferenceDate: '08/01',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
}

/**
 * Freshness line — real pull timestamp when live data is flowing, honest
 * placeholder copy in sample-data mode (rather than a fabricated per-source
 * cadence sentence, since this pipeline fetches everything together on demand,
 * not on independent per-source schedules).
 */
export function freshnessCopy(fetchedAt: string, source: 'live' | 'sample'): string {
  if (source === 'sample') return 'Sample data — no live pipeline configured';
  return `Warcraft Logs · Raider.IO · wowaudit · Blizzard, pulled ${relativeTime(fetchedAt)} · enchant reference table refreshed ${config.enchantReferenceDate}`;
}
