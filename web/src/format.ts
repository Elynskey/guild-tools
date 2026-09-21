/** "just now", "4 min ago", "3 hr ago", "2 days ago" from a moment in ms. */
export function timeAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** "Fri, Sep 18" from unix seconds. */
export function dayLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "9:30 PM" from unix seconds. */
export function clockLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Odasa#1204" -> "Odasa". */
export const shortName = (name: string) => name.split('#')[0];
