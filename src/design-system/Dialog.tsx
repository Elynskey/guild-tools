import type { MouseEvent, ReactNode } from 'react';
import { IconButton } from './IconButton';

/** Ported from _ds_bundle.js's Dialog.jsx. */

export interface DialogProps {
  open?: boolean;
  title?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  width?: number;
  className?: string;
}

export function Dialog({ open = true, title, eyebrow, children, footer, onClose, width = 480, className = '' }: DialogProps) {
  if (!open) return null;

  const stop = (e: MouseEvent<HTMLDivElement>) => e.stopPropagation();

  return (
    <div className="crd-scrim" role="presentation" onClick={onClose}>
      <div className={`crd-dialog ${className}`} role="dialog" aria-modal="true" style={{ maxWidth: width }} onClick={stop}>
        {(title || onClose) && (
          <div className="crd-dialog__head">
            <div>
              {eyebrow && <div className="crd-eyebrow">{eyebrow}</div>}
              <div className="crd-card__title">{title}</div>
            </div>
            {onClose && <IconButton icon="x" label="Close" size="sm" onClick={onClose} />}
          </div>
        )}
        <div className="crd-dialog__body">{children}</div>
        {footer && <div className="crd-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
