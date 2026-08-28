import './RaiderStatus.css';
import { SiteHeader } from './SiteHeader';
import { StatusRibbon } from './StatusRibbon';
import { ControlBar } from './ControlBar';
import { RoleSection } from './RoleSection';
import { RosterTable } from './RosterTable';
import { LedgerTable } from './LedgerTable';
import { ScoreKey } from './ScoreKey';
import { EmptyState } from './EmptyState';
import { KillsStrip } from './KillsStrip';
import { DeathMechanicsReport } from './DeathMechanicsReport';
import { RealmMismatchBanner } from './RealmMismatchBanner';
import { useRaiderStatus } from './useRaiderStatus';

export function RaiderStatus() {
  const rs = useRaiderStatus();

  if (rs.loadError) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-danger)' }}>{rs.loadError}</div>
    );
  }

  if (rs.loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading roster…</div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <SiteHeader
        windowTabs={rs.windowTabs}
        windowValue={rs.window}
        setWindow={rs.setWindow}
        progressionFraction={rs.progressionFraction}
        nights={rs.nights}
        selectedNightCode={rs.selectedNightCode}
        setSelectedNightCode={rs.setSelectedNightCode}
      />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <RealmMismatchBanner mismatches={rs.realmMismatches} />

        <StatusRibbon
          avgLine={rs.avgLine}
          freshness={rs.freshness}
          tiles={rs.tiles}
          toggleBand={rs.toggleBand}
          guildWell={rs.guildWell}
          guildStop={rs.guildStop}
          guildGate={rs.guildGate}
          onRefresh={rs.refresh}
          refreshing={rs.refreshing}
        />

        <DeathMechanicsReport entries={rs.deathMechanics} window={rs.window} />

        <ControlBar
          roleTabs={rs.roleTabs}
          roleValue={rs.role}
          setRole={rs.setRole}
          query={rs.query}
          setQuery={rs.setQuery}
          sortWorst={rs.sortWorst}
          setSortWorst={rs.setSortWorst}
        />

        {!rs.empty && (
          <>
            <div style={{ marginBottom: 6 }} className="crd-eyebrow">
              Roster
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 640 }}>
              Who's raiding this tier — class, spec, and gear completion.
            </p>
            {rs.groups.map((group) => (
              <RoleSection key={group.key} group={group}>
                <RosterTable rows={group.rows} />
              </RoleSection>
            ))}

            <div style={{ marginBottom: 6 }} className="crd-eyebrow">
              Performance
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 640 }}>
              Same roster, same order — score, trend, and death rate, {rs.window === 'night' ? 'that raid night' : 'tier-to-date'}.
            </p>
            <ScoreKey />
            {rs.groups.map((group) => (
              <RoleSection key={group.key} group={group}>
                <LedgerTable perfHeader={group.perfHeader} trendHeader={rs.trendHeader} rows={group.rows} toggleRow={rs.toggleRow} rioGateText={rs.rioGateText} ilvlGateText={rs.ilvlGateText} />
              </RoleSection>
            ))}
          </>
        )}

        {rs.empty && <EmptyState />}

        <KillsStrip progressionFraction={rs.progressionFraction} />
      </div>
    </div>
  );
}
