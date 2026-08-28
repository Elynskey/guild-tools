import { Icon } from '../../design-system/Icon';
import type { RealmMismatch } from '../../electron';

interface RealmMismatchBannerProps {
  mismatches: RealmMismatch[];
}

/**
 * Flags when wowaudit's realm for a character disagrees with what Warcraft Logs'
 * combat log actually shows -- the exact bug class that let a different real
 * person's stats get pulled in under "Dunbarke"'s name. Every stat on that row is
 * suspect until wowaudit's roster entry is corrected, so this sits above the ribbon.
 */
export function RealmMismatchBanner({ mismatches }: RealmMismatchBannerProps) {
  if (mismatches.length === 0) return null;

  return (
    <div className="crd-card" style={{ padding: '12px 18px', marginBottom: 20, background: 'rgba(168,50,50,.09)', border: '1px solid var(--accent-crimson)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon name="alert-triangle" size={14} color="var(--accent-crimson)" />
        <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--accent-crimson)' }}>
          Data check — wowaudit realm doesn't match the combat log
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {mismatches.map((m) => (
          <div key={m.name} style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-strong)' }}>{m.name}</span>{' '}
            — wowaudit says {m.wowauditRealm}, the log says {m.observedRealms.join(' / ')}. Stats on this row may belong to a different character. Fix the realm in wowaudit.
          </div>
        ))}
      </div>
    </div>
  );
}
