import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A dropdown that shows an icon next to each option -- native `<select>` (see
 * Select.tsx) can't render images inside its options reliably, which the boss/item
 * pickers in the loot-entry form need. Same crd-field/crd-label shell as Select.tsx
 * for a matching look, but the option list is a hand-rolled listbox instead of a
 * native popup.
 */
export interface IconSelectOption {
  value: string;
  label: string;
  /** Rendered via renderIcon -- kept generic (not just a URL) so callers can drop in an existing icon component (e.g. BossIcon) instead of a raw <img>. */
  icon?: ReactNode;
}

export interface IconSelectProps {
  label?: string;
  hint?: string;
  placeholder?: string;
  options: IconSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function IconSelect({ label, hint, placeholder = 'Select…', options, value, onChange, disabled }: IconSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="crd-field" ref={rootRef}>
      {label && (
        <label className="crd-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <span className="crd-select-wrap" style={{ position: 'relative' }}>
        <button
          id={fieldId}
          type="button"
          className="crd-select"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', color: selected ? 'var(--text-strong)' : 'var(--text-faint)' }}
        >
          {selected?.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label ?? placeholder}</span>
        </button>
        <Icon name="chevron-down" size={15} />
        {open && (
          <div
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 20,
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            {options.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>No options</div>
            ) : (
              options.map((o) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 'var(--text-body-s)',
                    color: o.value === value ? 'var(--text-gold)' : 'var(--text-body)',
                    background: o.value === value ? 'var(--action-secondary)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (o.value !== value) e.currentTarget.style.background = 'var(--surface-sunken)';
                  }}
                  onMouseLeave={(e) => {
                    if (o.value !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {o.icon}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                </div>
              ))
            )}
          </div>
        )}
      </span>
      {hint && <span className="crd-hint">{hint}</span>}
    </div>
  );
}
