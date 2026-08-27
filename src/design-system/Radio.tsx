import type { HTMLAttributes } from 'react';

/** Ported from _ds_bundle.js's Radio.jsx. */

export interface RadioProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  name?: string;
  value: string;
}

export function Radio({ label, checked = false, disabled = false, onChange, name, value, className = '', ...rest }: RadioProps) {
  return (
    <span
      className={`crd-choice ${className}`}
      data-disabled={disabled}
      role="radio"
      aria-checked={checked}
      data-name={name}
      data-value={value}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange?.(value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!disabled) onChange?.(value);
        }
      }}
      {...rest}
    >
      <span className="crd-choice__box crd-choice__box--radio" data-checked={checked} />
      {label}
    </span>
  );
}

export interface RadioGroupProps {
  label?: string;
  options?: (RadioProps['value'] | { value: string; label: string })[];
  value: string;
  onChange: (value: string) => void;
  row?: boolean;
  name?: string;
  className?: string;
}

export function RadioGroup({ label, options = [], value, onChange, row = false, name, className = '' }: RadioGroupProps) {
  return (
    <div className={`crd-field ${className}`}>
      {label && <span className="crd-label">{label}</span>}
      <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap: row ? 'var(--space-6)' : 'var(--space-1)', flexWrap: 'wrap' }}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <Radio key={opt.value} name={name} value={opt.value} label={opt.label} checked={value === opt.value} onChange={onChange} />;
        })}
      </div>
    </div>
  );
}
