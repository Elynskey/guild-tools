import type { HTMLAttributes, MouseEvent } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's Tag.jsx. */

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: string;
  selected?: boolean;
  onRemove?: (e: MouseEvent<HTMLSpanElement>) => void;
}

export function Tag({ children, icon, selected = false, onClick, onRemove, className = '', ...rest }: TagProps) {
  const cls = `crd-tag${selected ? ' crd-tag--selected' : ''}${onClick ? ' crd-tag--button' : ''} ${className}`;
  return (
    <span className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} {...rest}>
      {icon && <Icon name={icon} size={13} />}
      {children}
      {onRemove && (
        <span
          className="crd-tag__remove"
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
        >
          <Icon name="x" size={12} />
        </span>
      )}
    </span>
  );
}
