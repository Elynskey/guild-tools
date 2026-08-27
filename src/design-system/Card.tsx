import type { HTMLAttributes, ReactNode } from 'react';

/** Ported from _ds_bundle.js's Card.jsx. */

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  crest?: boolean;
  interactive?: boolean;
  padded?: boolean;
}

export function Card({ children, title, eyebrow, action, crest = false, interactive = false, padded, className = '', ...rest }: CardProps) {
  const hasHead = Boolean(title || eyebrow || action);
  const pad = padded ?? !hasHead;
  const cls = `crd-card${crest ? ' crd-card--crest' : ''}${interactive ? ' crd-card--interactive' : ''}${pad ? ' crd-card--pad' : ''} ${className}`;

  return (
    <div className={cls} {...rest}>
      {hasHead && (
        <div className="crd-card__head">
          <div>
            {eyebrow && <div className="crd-eyebrow">{eyebrow}</div>}
            {title && <div className="crd-card__title">{title}</div>}
          </div>
          {action}
        </div>
      )}
      {hasHead ? <div className="crd-card__body">{children}</div> : children}
    </div>
  );
}
