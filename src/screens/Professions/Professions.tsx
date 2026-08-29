import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Professions.css';
import { ProfessionsHeader } from './ProfessionsHeader';
import { DirectoryTab } from './directory/DirectoryTab';
import { CoverageTab } from './coverage/CoverageTab';
import { RequestsTab } from './requests/RequestsTab';
import { useProfessions } from './useProfessions';
import { computeExpansionOptions } from '../../professions/expansions';
import type { CraftRequest } from '../../professions/types';

export type ProfessionsTab = 'directory' | 'coverage' | 'requests';

export function Professions() {
  const p = useProfessions();
  const [tab, setTab] = useState<ProfessionsTab>('directory');
  const [expansion, setExpansion] = useState<string | null>(null);
  const [requests, setRequests] = useState<CraftRequest[]>([]);

  const expansionOptions = useMemo(() => computeExpansionOptions(p.members).options, [p.members]);

  // Default to whichever expansion looks "current" once data first loads, but never stomp
  // an officer's manual selection on a later refresh.
  const hasSetDefaultExpansionRef = useRef(false);
  useEffect(() => {
    if (hasSetDefaultExpansionRef.current || p.members.length === 0) return;
    hasSetDefaultExpansionRef.current = true;
    setExpansion(computeExpansionOptions(p.members).defaultExpansion);
  }, [p.members]);

  const handleRequestsChange = useCallback((next: CraftRequest[]) => setRequests(next), []);
  const openRequestCount = requests.filter((r) => !r.fulfilled).length;

  if (p.loadError) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-danger)' }}>{p.loadError}</div>;
  }

  if (p.loading || expansion === null) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ marginBottom: 12 }}>{p.progressLabel}</div>
        {p.progressPercent !== null && (
          <div style={{ maxWidth: 360, margin: '0 auto', height: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p.progressPercent}%`, background: 'var(--status-success)', transition: 'width .2s ease' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <ProfessionsHeader
        members={p.members}
        freshness={p.freshness}
        freshnessJustSynced={p.freshnessJustSynced}
        refreshing={p.refreshing}
        onRefresh={p.refresh}
        tab={tab}
        onTabChange={setTab}
        openRequestCount={openRequestCount}
      />

      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '24px 32px' }}>
        {tab === 'directory' && <DirectoryTab members={p.members} expansion={expansion} expansionOptions={expansionOptions} onExpansionChange={setExpansion} />}
        {tab === 'coverage' && (
          <CoverageTab members={p.members} catalogue={p.catalogue} expansion={expansion} expansionOptions={expansionOptions} onExpansionChange={setExpansion} requests={requests} />
        )}
        {tab === 'requests' && <RequestsTab onRequestsChange={handleRequestsChange} />}
      </div>
    </div>
  );
}
