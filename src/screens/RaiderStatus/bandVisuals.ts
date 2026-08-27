import type { Band } from '../../scoring/types';
import type { BadgeTone } from '../../design-system/Badge';

/**
 * Single source of truth for band -> color/tone, since the same band language repeats
 * across the distribution bar, tiles, row spine, mini progress bars, score text, and
 * the band Badge.
 */

// Row spine / score text: ineligible uses the muted --border-iron (row itself is also dimmed).
export const ROW_COLOR: Record<Band, string> = {
  green: 'var(--status-success)',
  yellow: 'var(--status-warning)',
  red: 'var(--status-danger)',
  ineligible: 'var(--border-iron)',
};

// Ribbon bar / legend tiles: ineligible uses the brighter --iron-200 so it stays visible in the legend.
export const TILE_COLOR: Record<Band, string> = {
  green: 'var(--status-success)',
  yellow: 'var(--status-warning)',
  red: 'var(--status-danger)',
  ineligible: 'var(--iron-200)',
};

export const BADGE_TONE: Record<Band, BadgeTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  ineligible: 'neutral',
};
