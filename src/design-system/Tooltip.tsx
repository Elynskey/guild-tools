import { useState, type ReactNode } from 'react';

/** Ported from _ds_bundle.js's Tooltip.jsx. */

export interface TooltipProps {
  label: ReactNode;
  placement?: 'top' | 'bottom' | 'right';
  children?: ReactNode;
  className?: string;
}

export function Tooltip({ label, placement = 'top', children, className = '' }: TooltipProps) {
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
        <span className={`crd-tip crd-tip--${placement}`} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
