import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import { Input } from '../../design-system/Input';
import { Badge } from '../../design-system/Badge';
import { HelpTooltip } from '../../design-system/HelpTooltip';
import { RefreshButton } from '../shared/RefreshButton';
import { useAnalytics, actionLabelFor, type CountRow } from './useAnalytics';

function isCuratedAction(event: string): boolean {
  return event !== 'screen_view' && event !== 'app_launch';
}

function BarRow({ row, max }: { row: CountRow; max: number }) {
  const pct = max > 0 ? Math.round((row.count / max) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '6px 0' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
        <div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold-300)' }} />
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{row.count}</div>
    </div>
  );
}

export function Analytics() {
  const [which, setWhich] = useState<'prod' | 'test'>('prod');
  const a = useAnalytics(which);
  const [eventFilter, setEventFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const maxScreen = Math.max(1, ...a.screenCounts.map((r) => r.count));
  const maxAction = Math.max(1, ...a.actionCounts.map((r) => r.count));

  const filteredEvents = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return a.events
      .filter((e) => eventFilter === 'all' || e.event === eventFilter)
      .filter((e) => {
        const t = new Date(e.at).getTime();
        if (from !== null && t < from) return false;
        if (to !== null && t > to) return false;
        return true;
      })
      .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  }, [a.events, eventFilter, fromDate, toDate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Analytics
                <HelpTooltip text="Every screen visit and key officer action, logged with a timestamp -- plus which app version each signed-in officer is currently running. A test-mode build's usage never mixes into this view." />
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          <Select
            label="Showing"
            value={which}
            onChange={(e) => setWhich(e.target.value as 'prod' | 'test')}
            options={[
              { value: 'prod', label: 'Officers using the real app' },
              { value: 'test', label: 'Test builds only' },
            ]}
            style={{ minWidth: 230 }}
          />
          <RefreshButton onRefresh={a.refresh} refreshing={a.loading} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {!a.available ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            Analytics require the desktop app.
          </div>
        ) : a.error ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--status-danger)' }}>{a.error}</div>
        ) : a.events.length === 0 && !a.loading ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No usage recorded yet -- this fills in as officers use the app.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="crd-card" style={{ padding: '18px 24px' }}>
                <div className="crd-eyebrow" style={{ marginBottom: 14 }}>Who's on what version</div>
                {a.officers.length === 0 ? (
                  <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>No sign-ins recorded yet.</div>
                ) : (
                  a.officers.map((o) => (
                    <div key={o.displayName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border-hairline)' }}>
                      <div style={{ fontSize: 'var(--text-body-s)', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.displayName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                        <Badge tone="gold">{o.appVersion ? `v${o.appVersion}` : 'unknown'}</Badge>
                        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{new Date(o.lastSeen).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="crd-card" style={{ padding: '18px 24px' }}>
                <div className="crd-eyebrow" style={{ marginBottom: 14 }}>Screens visited</div>
                {a.screenCounts.length === 0 ? (
                  <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>No screen visits recorded yet.</div>
                ) : (
                  a.screenCounts.map((row) => <BarRow key={row.label} row={row} max={maxScreen} />)
                )}
              </div>
            </div>

            <div className="crd-card" style={{ padding: '18px 24px', marginBottom: 20 }}>
              <div className="crd-eyebrow" style={{ marginBottom: 14 }}>Actions</div>
              {a.actionCounts.length === 0 ? (
                <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>No actions recorded yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }}>
                  {a.actionCounts.map((row) => (
                    <BarRow key={row.label} row={row} max={maxAction} />
                  ))}
                </div>
              )}
            </div>

            <div className="crd-card" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div className="crd-eyebrow" style={{ marginRight: 'auto' }}>Event log</div>
                <Select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  options={[{ value: 'all', label: 'All events' }, ...a.eventTypes.map((t) => ({ value: t, label: t === 'screen_view' ? 'Screen views' : t === 'app_launch' ? 'App launches' : actionLabelFor(t) }))]}
                  style={{ minWidth: 180 }}
                />
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 150 }} />
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 150 }} />
              </div>

              {filteredEvents.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No events match this filter.</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {filteredEvents.map((e) => (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr 160px', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--border-hairline)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{new Date(e.at).toLocaleString()}</span>
                      <Badge tone={isCuratedAction(e.event) ? 'gold' : 'neutral'}>{e.event === 'screen_view' ? 'screen view' : e.event === 'app_launch' ? 'app launch' : actionLabelFor(e.event)}</Badge>
                      <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.screen ?? '—'}</span>
                      <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.displayName ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
