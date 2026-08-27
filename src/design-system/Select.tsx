import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's Select.jsx. */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label?: string;
  hint?: string;
  options?: (SelectOption | string)[];
  id?: string;
  className?: string;
  children?: ReactNode;
}

export function Select({ label, hint, options = [], id, className = '', children, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div className={`crd-field ${className}`}>
      {label && (
        <label className="crd-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <span className="crd-select-wrap">
        <select id={fieldId} className="crd-select" {...rest}>
          {children ??
            options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o;
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            })}
        </select>
        <Icon name="chevron-down" size={15} />
      </span>
      {hint && <span className="crd-hint">{hint}</span>}
    </div>
  );
}
