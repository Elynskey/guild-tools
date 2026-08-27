import { useState, type HTMLAttributes } from 'react';

/** Ported from _ds_bundle.js's Switch.jsx. */

export interface SwitchProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}

export function Switch({ label, checked, defaultChecked, disabled = false, onChange, className = '', ...rest }: SwitchProps) {
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
      className={`crd-switch ${className}`}
      data-disabled={disabled}
      role="switch"
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
      <span className="crd-switch__track" data-checked={!!on}>
        <span className="crd-switch__knob" />
      </span>
      {label && <span className="crd-switch__label">{label}</span>}
    </span>
  );
}
