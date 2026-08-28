import { useUpdateCheck } from './useUpdateCheck';

export function UpdateBanner() {
  const { updateInfo, dismiss, openReleasePage, installing, error, installUpdate } = useUpdateCheck();
  if (!updateInfo) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-3)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-label)',
        color: 'var(--text-body)',
        maxWidth: 340,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ flex: 1 }}>
          Update available — <strong style={{ color: 'var(--text-gold)' }}>v{updateInfo.version}</strong>
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss update notice"
          title="Dismiss"
          style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={installUpdate}
          disabled={installing}
          style={{
            cursor: installing ? 'default' : 'pointer',
            border: '1px solid var(--border-strong)',
            background: 'var(--action-primary)',
            color: 'var(--text-on-gold)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 12px',
            fontSize: 'var(--text-label)',
            fontFamily: 'var(--font-ui)',
            opacity: installing ? 0.7 : 1,
          }}
        >
          {installing ? 'Downloading…' : 'Update now'}
        </button>
        <button
          type="button"
          onClick={openReleasePage}
          style={{
            cursor: 'pointer',
            border: '1px solid var(--border-strong)',
            background: 'var(--action-secondary)',
            color: 'var(--text-gold)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 12px',
            fontSize: 'var(--text-label)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          View release
        </button>
      </div>
      {error && <span style={{ color: 'var(--status-danger)', fontSize: 'var(--text-micro)' }}>{error} — try "View release" instead.</span>}
    </div>
  );
}
