import type { CSSProperties } from 'react';

/** Ported from _ds_bundle.js's Crest.jsx. */

export interface CrestProps {
  size?: number;
  wordmark?: boolean;
  assetBase?: string;
  className?: string;
  style?: CSSProperties;
}

export function Crest({ size = 64, wordmark = false, assetBase = './assets', className = '', style }: CrestProps) {
  const img = (
    <img
      src={`${assetBase}/guild-emblem.png`}
      alt="Casual Raid Days guild crest"
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: 'auto', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.55))' }}
    />
  );

  if (!wordmark) {
    return (
      <span className={className} style={style}>
        {img}
      </span>
    );
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.22), ...style }}>
      {img}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: Math.round(size * 0.46),
          letterSpacing: '0.1em',
          color: 'var(--text-gold)',
          lineHeight: 1,
        }}
      >
        CRD
      </span>
    </span>
  );
}
