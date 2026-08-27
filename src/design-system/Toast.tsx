import { Icon } from './Icon';
import { IconButton } from './IconButton';

/** Ported from _ds_bundle.js's Toast.jsx. */

export type ToastTone = 'success' | 'danger' | 'info' | 'neutral';

const GLYPH: Record<ToastTone, string> = { success: 'check', danger: 'triangle-alert', info: 'info', neutral: 'bell' };
const HUE: Record<ToastTone, string> = {
  success: 'var(--status-success)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--text-gold)',
};

export interface ToastProps {
  title?: string;
  message?: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  className?: string;
}

export function Toast({ title, message, tone = 'neutral', onDismiss, className = '' }: ToastProps) {
  return (
    <div className={`crd-toast crd-toast--${tone} ${className}`} role="status">
      <Icon name={GLYPH[tone] ?? GLYPH.neutral} size={16} color={HUE[tone]} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="crd-toast__title">{title}</div>
        {message && <div className="crd-toast__msg">{message}</div>}
      </div>
      {onDismiss && <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} />}
    </div>
  );
}
