/**
 * '<route path>' -> friendly screen name. Shared by anything that needs to describe
 * "which screen is the officer looking at" -- the feedback button (so a report says
 * "Raid Signups" instead of "/raid-signups") and the analytics screen-view tracker.
 * Falls back to the raw path for anything not listed here (a new screen added later,
 * say) rather than showing nothing.
 */
export const SCREEN_LABELS: Record<string, string> = {
  '/': 'Landing',
  '/raider-status': 'Raider Status',
  '/professions': 'Professions',
  '/pull-feedback': 'Pull Feedback',
  '/loot-history': 'Loot History',
  '/loot-report': 'Season Loot Report',
  '/mythic-plus': 'M+ Keys',
  '/settings': 'Settings',
  '/raid-signups': 'Raid Signups',
  '/gotm': 'Guildie of the Month',
  '/analytics': 'Analytics',
  '/test-tools/mplus-comp': 'M+ Comp',
};

export function screenLabelFor(pathname: string): string {
  return SCREEN_LABELS[pathname] ?? pathname;
}
