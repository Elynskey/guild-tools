import { Link } from 'react-router-dom';
import { Badge } from '../design-system/Badge';
import { Crest } from '../design-system/Crest';
import { HelpTooltip } from '../design-system/HelpTooltip';
import { RefreshButton } from '../screens/shared/RefreshButton';
import { itemLabel } from '../raid/lootLogic';
import { useLootMonitor } from './useLootMonitor';
import { ago, difficultyName, type CheckGroup, type CheckStatus, type HealthCheck } from './lootPipelineHealth';

const GROUPS: { id: CheckGroup; title: string; blurb: string }[] = [
  { id: 'Setup', title: 'Setup', blurb: 'Is everything the pipeline needs in place?' },
  { id: 'Capture', title: 'Capture', blurb: 'Boss dies, loot rolls, the win is seen.' },
  { id: 'Sync', title: 'Sync', blurb: 'Chat log to addon to the shared store.' },
  { id: 'Output', title: 'Output', blurb: 'What officers actually see.' },
];

const TONE: Record<CheckStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { ok: 'success', warn: 'warning', fail: 'danger', idle: 'neutral' };
const LABEL: Record<CheckStatus, string> = { ok: 'Working', warn: 'Look', fail: 'Broken', idle: 'Waiting' };
const OVERALL_TEXT: Record<CheckStatus, string> = {
  ok: 'Everything that has happened so far went through cleanly.',
  warn: 'Nothing is broken, but something needs a look (see the amber rows).',
  fail: 'Something in the pipeline is broken (see the red rows).',
  idle: 'Nothing has happened yet: kill a boss and roll on something.',
};

const KIND_LABEL: Record<string, string> = { 'boss-kill': 'Boss kill', 'chat-win': 'Need win', enrich: 'Attribution', 'store-sync': 'Store', 'addon-sync': 'Addon data' };
const KIND_TONE: Record<string, 'gold' | 'success' | 'warning' | 'neutral'> = { 'boss-kill': 'gold', 'chat-win': 'success', enrich: 'neutral', 'store-sync': 'neutral', 'addon-sync': 'neutral' };

function CheckRow({ check }: { check: HealthCheck }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '92px 250px 1fr', gap: 14, alignItems: 'baseline', padding: '9px 20px', borderTop: '1px solid var(--border-hairline)' }}>
      <div>
        <Badge tone={TONE[check.status]} dot>
          {LABEL[check.status]}
        </Badge>
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--text-body-s)' }}>{check.label}</div>
      <div style={{ color: check.status === 'idle' ? 'var(--text-faint)' : 'var(--text-body)', fontSize: 'var(--text-body-s)', lineHeight: 1.5 }}>{check.detail}</div>
    </div>
  );
}

export function LootMonitor() {
  const m = useLootMonitor();
  const now = m.snapshot?.now ?? Date.now();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Guild Tools (Test) · test-only tool</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Loot Logger Monitor
                <HelpTooltip text="Watches every hand-off in the loot pipeline on this PC while you play: the boss kill in the combat log, Need wins in the chat log, the test addon's saved data, the shared test store, the test Discord channel. It only reads; it never changes anything (except that reading the store also offers your addon's wins to the TEST store)." />
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          <RefreshButton onRefresh={m.refresh} refreshing={false} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {m.error && <div className="crd-card" style={{ padding: '16px 20px', color: 'var(--status-warning)' }}>{m.error}</div>}
        {!m.snapshot || !m.health ? (
          !m.error && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Reading the pipeline…</div>
        ) : (
          <>
            <div className="crd-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderColor: m.health.overall === 'fail' ? 'rgba(192,80,60,.6)' : m.health.overall === 'warn' ? 'rgba(192,144,47,.5)' : undefined }}>
              <Badge tone={TONE[m.health.overall]} dot>
                {m.health.overall === 'ok' ? 'All clear' : m.health.overall === 'warn' ? 'Needs a look' : m.health.overall === 'fail' ? 'Broken' : 'Waiting for a kill'}
              </Badge>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{OVERALL_TEXT[m.health.overall]}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                this session: {m.snapshot.kills.length} kill(s) · {m.snapshot.events.filter((e) => e.kind === 'chat-win').length} win(s) seen · store checked {m.storeCheckedAt ? ago(m.storeCheckedAt, now) : 'not yet'}
              </span>
            </div>

            {GROUPS.map((g) => {
              const checks = m.health!.checks.filter((c) => c.group === g.id);
              return (
                <div key={g.id} className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{g.title}</div>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{g.blurb}</div>
                  </div>
                  {checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </div>
              );
            })}

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>Timeline</div>
              {m.snapshot.events.length === 0 ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>Nothing yet. Boss kills, Need wins and store pushes land here the moment they happen.</div>
              ) : (
                [...m.snapshot.events].reverse().map((e) => (
                  <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '78px 110px 1fr', gap: 12, alignItems: 'baseline', padding: '7px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{new Date(e.at).toLocaleTimeString()}</div>
                    <div>
                      <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
                      {e.text}
                      {e.kind === 'boss-kill' && typeof e.meta?.difficultyId === 'number' ? ` (${difficultyName(e.meta.difficultyId)})` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>
                What the test addon has saved
                <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>updates at /reload or logout</span>
              </div>
              {m.snapshot.addonData.recentWins.length === 0 ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>
                  {m.snapshot.addonData.wins} win(s) in the addon's saved data.
                </div>
              ) : (
                m.snapshot.addonData.recentWins.map((w, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '78px 160px 1fr 1fr', gap: 12, alignItems: 'baseline', padding: '7px 20px', borderTop: '1px solid var(--border-hairline)', fontSize: 'var(--text-body-s)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{new Date(w.time * 1000).toLocaleTimeString()}</div>
                    <div style={{ color: 'var(--text-strong)' }}>{w.winner}</div>
                    <div>{itemLabel(w.itemLink)}</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {[w.zone, w.contentType, w.difficulty, w.boss].filter(Boolean).join(' · ') || 'no zone recorded'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
