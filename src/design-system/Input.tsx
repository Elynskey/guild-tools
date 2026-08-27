import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Ported from _ds_bundle.js's Input.jsx. */

interface SharedProps {
  label?: string;
  hint?: string;
  error?: string;
  icon?: string;
  id?: string;
  className?: string;
}

export interface InputProps extends SharedProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  multiline?: false;
}

export interface TextareaProps extends SharedProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  multiline: true;
  rows?: number;
}

export function Input(props: InputProps | TextareaProps) {
  const { label, hint, error, icon, id, multiline = false, className = '', ...rest } = props;
  const autoId = useId();
  const fieldId = id ?? autoId;

  const control = multiline ? (
    <textarea id={fieldId} rows={(rest as TextareaProps).rows ?? 3} className={`crd-textarea${error ? ' crd-input--invalid' : ''}`} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
  ) : (
    <input id={fieldId} className={`crd-input${error ? ' crd-input--invalid' : ''}`} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
  );

  return (
    <div className={`crd-field ${className}`}>
      {label && (
        <label className="crd-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      {icon && !multiline ? (
        <span className="crd-input-wrap crd-input-wrap--icon">
          <Icon name={icon} size={15} />
          {control}
        </span>
      ) : (
        control
      )}
      {(error || hint) && <span className={`crd-hint${error ? ' crd-hint--error' : ''}`}>{error || hint}</span>}
    </div>
  );
}
