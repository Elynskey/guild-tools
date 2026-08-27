import { useState, type ReactNode } from 'react';

/** Ported from _ds_bundle.js's Tooltip.jsx. */

export interface TooltipProps {
  label: ReactNode;
  placement?: 'top' | 'bottom' | 'right';
  children?: ReactNode;
  className?: string;
  /** .crd-tip is nowrap by design for short labels ("Refresh live data") — set this for
   * longer, sentence-length explanations instead of letting them stretch edge-to-edge. */
  wrap?: boolean;
}

export function Tooltip({ label, placement = 'top', children, className = '', wrap = false }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`crd-tip-anchor ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          className={`crd-tip crd-tip--${placement}`}
          role="tooltip"
          // Long-form tooltips shouldn't inherit an eyebrow-styled anchor's uppercase/tracking --
          // a whole sentence in caps with wide letter-spacing is much harder to read than a label is.
          style={wrap ? { whiteSpace: 'normal', width: 240, textTransform: 'none', letterSpacing: 'normal' } : undefined}
        >
          {label}
        </span>
      )}
    </span>
  );
}
