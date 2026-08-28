import { specIconFallback } from '../scoring/specIcons';
import { bossIconUrl } from './bossIcons';

interface BossIconProps {
  boss: string;
  size?: number;
}

/** Boss portrait, or nothing at all for a boss not in bossIcons.ts's reference (no broken-image placeholder). */
export function BossIcon({ boss, size = 22 }: BossIconProps) {
  const url = bossIconUrl(boss);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={boss}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = specIconFallback;
      }}
      style={{ flex: 'none', width: size, height: size, borderRadius: '50%', border: '1px solid var(--border-hairline)', objectFit: 'cover', boxShadow: 'var(--shadow-1)' }}
    />
  );
}
