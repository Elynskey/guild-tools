import { useState, type HTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's Checkbox.jsx. */

export interface CheckboxProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}

export function Checkbox({ label, checked, defaultChecked, disabled = false, onChange, className = '', ...rest }: CheckboxProps) {
  const [internal, setInternal] = useState(!!defaultChecked);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange?.(!on);
  };

  return (
    <span
      className={`crd-choice ${className}`}
      data-disabled={disabled}
      role="checkbox"
      aria-checked={!!on}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      {...rest}
    >
      <span className="crd-choice__box crd-choice__box--check" data-checked={!!on}>
        {on && <Icon name="check" size={13} />}
      </span>
      {label}
    </span>
  );
}
