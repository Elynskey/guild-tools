import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Icon } from '../../design-system/Icon';
import { IconButton } from '../../design-system/IconButton';
import { specIcon } from '../../scoring/specIcons';
import type { MythicPlusRun } from '../../scoring/types';
import { useMythicPlus, type MythicPlusRow } from './useMythicPlus';

const GRID_TEMPLATE = '1fr 110px 1fr 24px';

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function upgradeColor(upgrades: number): string {
  if (upgrades >= 3) return 'var(--status-success)';
  if (upgrades >= 1) return 'var(--status-warning)';
  return 'var(--text-faint)';
}

function RunRow({ run }: { run: MythicPlusRun }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)' }}>
      <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{run.dungeon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: upgradeColor(run.upgrades) }}>+{run.level}</span>
      <span style={{ color: 'var(--text-faint)' }}>{run.upgrades > 0 ? `${run.upgrades} chest${run.upgrades === 1 ? '' : 's'}` : 'depleted'}</span>
      <span style={{ color: 'var(--text-faint)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{run.score.toFixed(0)}</span>
      <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', minWidth: 60, textAlign: 'right' }}>{ageLabel(run.completedAt)}</span>
    </div>
  );
}

function Row({ raider, isOpen, onToggle }: { raider: MythicPlusRow; isOpen: boolean; onToggle: () => void }) {
  const [broken, setBroken] = useState(false);
  const avatarSrc = !broken && raider.portraitUrl ? raider.portraitUrl : specIcon(raider.spec, raider.class);
  const mostRecent = raider.runs[0] ?? null;

  return (
    <div>
      <div
        onClick={onToggle}
        className="raider-row"
        style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 12, alignItems: 'center', padding: '9px 18px', borderTop: '1px solid var(--border-hairline)', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img
            src={avatarSrc}
            alt={`${raider.spec} ${raider.class}`}
            title={`${raider.spec} ${raider.class}`}
            onError={() => setBroken(true)}
            style={{
              flex: 'none',
              width: 26,
              height: 26,
              border: '1px solid var(--border-hairline)',
              borderRadius: raider.portraitUrl && !broken ? '50%' : 2,
              objectFit: 'cover',
              boxShadow: 'var(--shadow-1)',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-strong)' }}>
              {raider.name}
            </div>
            <div style={{ marginTop: 1, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
              {raider.spec} {raider.class}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-gold)' }}>{raider.rioCurrent}</div>
        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
          {mostRecent ? <RunRow run={mostRecent} /> : <span style={{ color: 'var(--text-faint)' }}>No recent runs</span>}
        </div>
        {raider.runs.length > 1 ? <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-faint)" /> : <div />}
      </div>

      {isOpen && raider.runs.length > 1 && (
        <div style={{ padding: '10px 18px 16px 54px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-hairline)', boxShadow: 'var(--inset-well)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {raider.runs.slice(1).map((run, i) => (
              <RunRow key={i} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MythicPlus() {
  const mp = useMythicPlus();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                M+ Keys
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          <IconButton icon="refresh-cw" label={mp.refreshing ? 'Refreshing…' : 'Refresh'} framed disabled={mp.refreshing} onClick={mp.refresh} style={{ opacity: mp.refreshing ? 0.6 : 1 }} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <p style={{ margin: '0 0 20px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 640 }}>
          Raider.IO score and recent Mythic+ activity, per raider — click a row for their last 10 runs.
        </p>

        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Filter by raider…"
            value={mp.query}
            onChange={(e) => mp.setQuery(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-raised)',
              color: 'var(--text-body)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-body-s)',
              minWidth: 220,
            }}
          />
        </div>

        {mp.loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : mp.empty ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No roster data available.
          </div>
        ) : (
          <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 12, padding: '8px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
              <div className="crd-eyebrow">Raider</div>
              <div className="crd-eyebrow" style={{ textAlign: 'right' }}>
                RIO Score
              </div>
              <div className="crd-eyebrow">Most recent run</div>
              <div />
            </div>

            {mp.rows.map((r) => (
              <Row key={r.name} raider={r} isOpen={expanded === r.name} onToggle={() => setExpanded(expanded === r.name ? null : r.name)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
