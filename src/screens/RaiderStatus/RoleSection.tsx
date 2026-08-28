import type { ReactNode } from 'react';
import { Icon } from '../../design-system/Icon';
import type { RoleGroup } from './useRaiderStatus';

interface RoleSectionProps {
  group: RoleGroup;
  children: ReactNode;
}

/** Role header (icon, label, count, rule) wrapping whatever table the caller passes -- reused for both the Roster and Performance sections, same role grouping either way. */
export function RoleSection({ group, children }: RoleSectionProps) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Icon name={group.icon} size={20} style={{ color: 'var(--gold-300)' }} />
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-s)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)' }}>
          {group.label}
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{group.count}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--rule-gold)' }} />
      </div>
      {children}
    </section>
  );
}
