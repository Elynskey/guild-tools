import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's IconButton.jsx. */

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  icon: string;
  label: string;
  size?: 'sm' | 'md';
  framed?: boolean;
}

export function IconButton({ icon, label, size = 'md', framed = false, disabled = false, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`crd-iconbtn crd-iconbtn--${size}${framed ? ' crd-iconbtn--framed' : ''} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}
