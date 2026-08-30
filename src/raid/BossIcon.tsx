import { useState } from 'react';
import { specIconFallback } from '../scoring/specIcons';
import { bossIconCrop, bossIconUrl } from './bossIcons';

interface BossIconProps {
  boss: string;
  size?: number;
}

/**
 * Boss portrait, or nothing at all for a boss not in bossIcons.ts's reference (no
 * broken-image placeholder). Blizzard's API only ever exposes one image per creature
 * (the "zoom" render -- confirmed live against the real media/creature-display
 * endpoint, no separate portrait/headshot asset exists), and it's framed with a lot
 * of headroom/body below the face. Rendered as a CSS background-image, oversized and
 * positioned per bossIconCrop, so the face fills more of the frame than the wide zoom
 * shot would as-is -- see bossIcons.ts for why this has to be background-size/
 * background-position rather than <img> object-fit/object-position.
 */
export function BossIcon({ boss, size = 22 }: BossIconProps) {
  const url = bossIconUrl(boss);
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  const crop = bossIconCrop(boss);

  return (
    <div
      title={boss}
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-1)',
        backgroundImage: `url(${failed ? specIconFallback : url})`,
        backgroundSize: failed ? 'cover' : `${crop.scale}%`,
        backgroundPosition: failed ? 'center' : crop.position,
        backgroundRepeat: 'no-repeat',
        filter: !failed && crop.brighten ? `brightness(${crop.brighten})` : undefined,
      }}
    >
      {/* Invisible -- exists only to detect a 404/load failure and swap to the fallback above, since a CSS background-image has no error event of its own. */}
      <img src={url} alt="" onError={() => setFailed(true)} style={{ display: 'none' }} />
    </div>
  );
}
