import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Tabs } from '../design-system/Tabs';
import { Crest } from '../design-system/Crest';
import { HelpTooltip } from '../design-system/HelpTooltip';
import { RefreshButton } from '../screens/shared/RefreshButton';
import { itemLabel } from '../raid/lootLogic';
import { ADDON_COMMANDS } from './addonCommands';
import { useLootMonitor, type ActionState } from './useLootMonitor';
import type { MonitorView } from './lootPipelineHealth';
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

const LINE_KIND: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }> = {
  'need-win': { label: 'Need win', tone: 'success' },
  'other-roll-won': { label: 'Other roll won', tone: 'neutral' },
  'need-selected': { label: 'Rolled Need', tone: 'neutral' },
  passed: { label: 'Passed', tone: 'neutral' },
  'personal-loot': { label: 'Personal loot', tone: 'warning' },
  'loot-other': { label: 'Other loot line', tone: 'neutral' },
};

function ActionResult({ state }: { state: ActionState }) {
  if (!state.lines.length) return null;
  const colour = state.tone === 'success' ? 'var(--status-success)' : state.tone === 'danger' ? 'var(--status-danger)' : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--text-body-s)', color: colour }}>
      {state.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

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

const VIEW_KEY = 'gt.lootMonitor.view';
function loadView(): MonitorView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'live' ? 'live' : 'test';
  } catch {
    return 'test';
  }
}

export function LootMonitor() {
  const [view, setViewState] = useState<MonitorView>(loadView);
  const setView = (v: MonitorView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // remembering the choice is a convenience only
    }
  };
  const m = useLootMonitor(view);
  const live = view === 'live';
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
          <Tabs
            aria-label="Which pipeline to watch"
            tabs={[
              { value: 'test', label: 'Test' },
              { value: 'live', label: 'Live (read-only)' },
            ]}
            value={view}
            onChange={(v) => setView(v as MonitorView)}
          />
          <RefreshButton onRefresh={m.refresh} refreshing={false} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="crd-card" style={{ padding: '12px 20px', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', borderColor: live ? 'rgba(192,144,47,.55)' : undefined }}>
          {live ? (
            <>
              <strong style={{ color: 'var(--text-gold)' }}>Live view: the real guild.</strong> Reads the real loot log, the real loot channel setting, the officers&apos; apps the proxy hears from, and this PC&apos;s real GuildToolsLoot addon. Read-only: nothing on this page writes to the real loot log or to Discord.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-gold)' }}>Test view.</strong> This build&apos;s own pipeline: the test addon, the test loot log, the test Discord channel. Switch to Live (read-only) to watch the real guild instead.
            </>
          )}
        </div>
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
                {live
                  ? `${m.snapshot.kills.length} kill(s) seen on this PC · ${m.officers ? m.officers.length : '?'} officer app(s) open · store checked ${m.storeCheckedAt ? ago(m.storeCheckedAt, now) : 'not yet'}`
                  : `this session: ${m.snapshot.kills.length} kill(s) · ${m.snapshot.events.filter((e) => e.kind === 'chat-win').length} win(s) seen · store checked ${m.storeCheckedAt ? ago(m.storeCheckedAt, now) : 'not yet'}`}
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

            <div className="crd-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                {live ? 'Report' : 'Test actions'}
                <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{live ? 'the Live view is read-only, so the fake-win and clear actions are only in the Test view' : 'all of these use the TEST store and the TEST Discord only'}</span>
              </div>
              {!live && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" disabled={m.synthetic.running} onClick={() => void m.sendSyntheticWin()}>
                  Send a fake win through the pipeline
                </Button>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', marginBottom: 4 }}>No WoW needed: proves this PC, the proxy, the test store and the test Discord post all work, then removes the fake record.</div>
                  <ActionResult state={m.synthetic} />
                </div>
              </div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Button variant="secondary" size="sm" onClick={() => void m.copyDebugReport()}>
                  Copy debug report
                </Button>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', marginBottom: 4 }}>Everything on this page as one block of text to paste into a message (no secrets in it).</div>
                  <ActionResult state={m.copyState} />
                </div>
              </div>
              {!live && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={m.clearState.running}
                  onClick={() => {
                    if (window.confirm('Empty the TEST loot log? (The real loot log is not touched.)')) void m.clearTestLoot();
                  }}
                >
                  Clear the test loot log
                </Button>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', marginBottom: 4 }}>Start a run from a clean slate.</div>
                  <ActionResult state={m.clearState} />
                </div>
              </div>
              )}
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>
                {live ? 'Addon commands' : 'Test addon commands'}
                <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>type these in WoW chat; /gtloottest help prints the same list in game{live ? ' (these are for the test addon; the real addon has /gtloot)' : ''}</span>
              </div>
              {ADDON_COMMANDS.map((c) => (
                <div key={c.command} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 1fr', gap: 14, alignItems: 'baseline', padding: '8px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-strong)' }}>/gtloottest {c.command}</div>
                  <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', lineHeight: 1.5 }}>{c.does}</div>
                  <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.when}</div>
                </div>
              ))}
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>
                What WoW actually wrote (chat log loot lines)
                <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>the raw truth: if a win is not here, the app never had a chance to see it</span>
              </div>
              {!m.feeds?.lootLines.available ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>The chat log could not be read (missing, or chat logging is off).</div>
              ) : m.feeds.lootLines.lines.length === 0 ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No loot lines in the recent chat log.</div>
              ) : (
                m.feeds.lootLines.lines.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 120px 1fr', gap: 12, alignItems: 'baseline', padding: '7px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{l.time ?? '?'}</div>
                    <div>
                      <Badge tone={LINE_KIND[l.kind]?.tone ?? 'neutral'}>{LINE_KIND[l.kind]?.label ?? l.kind}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', wordBreak: 'break-word' }}>{l.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>
                Boss pulls in the combat log
                <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>kills and wipes; only a kill starts the wait for loot</span>
              </div>
              {!m.feeds?.pulls.available ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No combat log found (turn on advanced combat logging or /combatlog).</div>
              ) : m.feeds.pulls.pulls.length === 0 ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No boss pulls in the recent combat log.</div>
              ) : (
                m.feeds.pulls.pulls.map((p, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '78px 110px 1fr 160px', gap: 12, alignItems: 'baseline', padding: '7px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{new Date(p.at).toLocaleTimeString()}</div>
                    <div>
                      <Badge tone={p.kill ? 'success' : 'danger'}>{p.kill ? 'Kill' : 'Wipe'}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-strong)' }}>{p.boss}</div>
                    <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{difficultyName(p.difficultyId)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-strong)' }}>Timeline</div>
              {live ? (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-hairline)', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>Not shown in the Live view: this app&apos;s own diary is about the test pipeline. The checks above are read from the real store and the officers&apos; apps.</div>
              ) : m.snapshot.events.length === 0 ? (
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
                {live ? 'What this PC\'s real addon has saved' : 'What the test addon has saved'}
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
