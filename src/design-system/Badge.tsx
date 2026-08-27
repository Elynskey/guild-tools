import type { CSSProperties, HTMLAttributes } from 'react';

/** Ported from _ds_bundle.js's Badge.jsx — 7 hardcoded tone palettes, kept verbatim. */

export type BadgeTone = 'neutral' | 'gold' | 'success' | 'info' | 'warning' | 'danger' | 'prestige';

const TONES: Record<BadgeTone, { color: string; border: string; bg: string }> = {
  neutral: { color: 'var(--text-muted)', border: 'var(--border-iron)', bg: 'var(--surface-raised)' },
  gold: { color: 'var(--gold-300)', border: 'rgba(212,179,88,.45)', bg: 'rgba(192,144,47,.12)' },
  success: { color: '#8fc47c', border: 'rgba(95,158,74,.5)', bg: 'rgba(95,158,74,.14)' },
  info: { color: '#7fb0d8', border: 'rgba(63,127,181,.5)', bg: 'rgba(63,127,181,.14)' },
  warning: { color: '#e0885a', border: 'rgba(194,91,40,.5)', bg: 'rgba(194,91,40,.14)' },
  danger: { color: '#d67373', border: 'rgba(168,50,50,.55)', bg: 'rgba(168,50,50,.16)' },
  prestige: { color: '#b28fd0', border: 'rgba(138,95,176,.5)', bg: 'rgba(138,95,176,.16)' },
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  style?: CSSProperties;
}

export function Badge({ children, tone = 'neutral', dot = false, className = '', style, ...rest }: BadgeProps) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span className={`crd-badge ${className}`} style={{ color: t.color, borderColor: t.border, background: t.bg, ...style }} {...rest}>
      {dot && <span className="crd-badge__dot" />}
      {children}
    </span>
  );
}
