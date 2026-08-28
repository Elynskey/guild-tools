import './RaiderStatus.css';
import { SiteHeader } from './SiteHeader';
import { StatusRibbon } from './StatusRibbon';
import { ControlBar } from './ControlBar';
import { RoleSection } from './RoleSection';
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

        {rs.groups.map((group) => (
          <RoleSection key={group.key} group={group} trendHeader={rs.trendHeader} toggleRow={rs.toggleRow} rioGateText={rs.rioGateText} ilvlGateText={rs.ilvlGateText} />
        ))}

        {rs.empty && <EmptyState />}

        <KillsStrip progressionFraction={rs.progressionFraction} />
      </div>
    </div>
  );
}
