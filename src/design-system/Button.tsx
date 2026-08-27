import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's Button.jsx. */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: string;
  iconRight?: string;
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

export type ButtonProps = SharedProps &
  (
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  );

export function Button(props: ButtonProps) {
  const { children, variant = 'primary', size = 'md', iconLeft, iconRight, block = false, disabled = false, href, className = '', ...rest } = props;
  const cls = `crd-btn crd-btn--${variant} crd-btn--${size}${block ? ' crd-btn--block' : ''} ${className}`;
  const glyph = size === 'lg' ? 16 : 14;
  const inner = (
    <>
      {iconLeft && <Icon name={iconLeft} size={glyph} />}
      {children}
      {iconRight && <Icon name={iconRight} size={glyph} />}
    </>
  );

  if (href) {
    return (
      <a className={cls} href={href} aria-disabled={disabled || undefined} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} disabled={disabled} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}
