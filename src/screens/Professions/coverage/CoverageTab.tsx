import { useMemo, useState } from 'react';
import { Select } from '../../../design-system/Select';
import { Button } from '../../../design-system/Button';
import { Badge } from '../../../design-system/Badge';
import { professionIconUrl } from '../../../professions/professionCatalog';
import { flattenCharacters, ALL_EXPANSIONS_FILTER } from '../../../professions/directoryLogic';
import { buildCoverageTable, findUncoveredRecipes, findNearMax, findStalled, buildRequestSummary, buildDiscordReportLines, type CoverageState } from '../../../professions/coverageLogic';
import { copyToClipboard } from '../../../professions/professionsSource';
import { GRAD_CREST } from '../theme';
import type { MemberProfessions, CraftRequest, RecipeCatalogue } from '../../../professions/types';

function barColor(pct: number): string {
  return pct > 0 ? 'var(--grad-gold)' : 'var(--accent-crimson)';
}
const STATE_TONE: Record<CoverageState, 'danger' | 'warning' | 'success'> = { Gap: 'danger', Thin: 'warning', Covered: 'success' };

const COV_COLS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'Profession', align: 'left' },
  { label: 'Have it', align: 'right' },
  { label: 'Maxed', align: 'right' },
  { label: 'Maxed share', align: 'left' },
  { label: 'Top crafter', align: 'left' },
  { label: '', align: 'right' },
];

interface CoverageTabProps {
  members: MemberProfessions[];
  catalogue: RecipeCatalogue;
  expansion: string;
  expansionOptions: string[];
  onExpansionChange: (v: string) => void;
  requests: CraftRequest[];
}

export function CoverageTab({ members, catalogue, expansion, expansionOptions, onExpansionChange, requests }: CoverageTabProps) {
  const [copied, setCopied] = useState('');
  const chars = useMemo(() => flattenCharacters(members), [members]);

  // "Recipes nobody knows" needs one concrete expansion, not "All expansions" -- fall back
  // to the newest real expansion in the data, same reasoning as the design's own fallback.
  const realOptions = expansionOptions.filter((e) => e !== ALL_EXPANSIONS_FILTER);
  const gapExpansion = expansion === ALL_EXPANSIONS_FILTER ? (realOptions[realOptions.length - 1] ?? expansion) : expansion;

  const coverage = useMemo(() => buildCoverageTable(chars), [chars]);
  const gapRecipes = useMemo(() => findUncoveredRecipes(chars, catalogue, gapExpansion), [chars, catalogue, gapExpansion]);
  const nearMax = useMemo(() => findNearMax(chars), [chars]);
  const stalled = useMemo(() => findStalled(chars), [chars]);
  const requestSummary = useMemo(() => buildRequestSummary(requests), [requests]);
  const openRequestCount = requests.filter((r) => !r.fulfilled).length;

  const copyReport = () => {
    const lines = buildDiscordReportLines(coverage, gapRecipes, openRequestCount, gapExpansion);
    void copyToClipboard(lines.join('\n'));
    setCopied(`Copied ${lines.length} lines to the clipboard — paste into #guild-crafting.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ marginRight: 'auto', maxWidth: 640 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', fontSize: 'var(--text-display-s)', color: 'var(--text-gold)' }}>Coverage & Gaps</div>
          <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>Where the guild is covered, where it is not, and who is close enough to be worth a nudge. Scoped to {expansion}.</div>
        </div>
        <div style={{ width: 210 }}>
          <Select label="Expansion" options={[ALL_EXPANSIONS_FILTER, ...expansionOptions.filter((e) => e !== ALL_EXPANSIONS_FILTER)]} value={expansion} onChange={(e) => onExpansionChange(e.target.value)} />
        </div>
        <Button variant="secondary" size="md" iconLeft="clipboard-copy" onClick={copyReport}>
          Copy for Discord
        </Button>
      </div>

      {copied && (
        <div style={{ padding: '9px 14px', border: '1px solid var(--border-soft)', borderRadius: 5, background: 'rgba(95,158,74,.1)', color: 'var(--text-body)', fontSize: 'var(--text-body-s)' }}>{copied}</div>
      )}

      <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
        <div
          style={{
            padding: '11px 18px',
            background: 'var(--grad-header)',
            borderBottom: '1px solid var(--border-soft)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            letterSpacing: '.05em',
            fontSize: 'var(--text-title-m)',
            color: 'var(--text-gold)',
          }}
        >
          Profession coverage
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 96px 96px 1fr 200px 96px', gap: 14, padding: '8px 18px', borderBottom: '1px solid var(--border-hairline)' }}>
          {COV_COLS.map((c) => (
            <div key={c.label || 'state'} style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--text-faint)', textAlign: c.align }}>
              {c.label}
            </div>
          ))}
        </div>
        {coverage.map((row) => (
          <div key={row.profession} style={{ display: 'grid', gridTemplateColumns: '180px 96px 96px 1fr 200px 96px', gap: 14, padding: '9px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                letterSpacing: '.03em',
                fontSize: 'var(--text-title-s)',
                color: row.maxed ? 'var(--text-strong)' : 'var(--status-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
              }}
            >
              <img src={professionIconUrl(row.profession)} alt="" style={{ width: 20, height: 20, borderRadius: 3, border: '1px solid var(--border-iron)', flex: 'none', objectFit: 'cover' }} />
              {row.profession}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', textAlign: 'right' }}>{row.holders}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: row.maxed ? 'var(--text-gold)' : 'var(--status-danger)', textAlign: 'right' }}>{row.maxed}</span>
            <span style={{ height: 6, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
              <span style={{ display: 'block', height: '100%', width: `${row.maxedSharePercent}%`, background: barColor(row.maxed) }} />
            </span>
            <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.topCrafterName ? `${row.topCrafterName} · ${row.topCrafterSkill}` : 'nobody'}
            </span>
            <span style={{ textAlign: 'right' }}>
              <Badge tone={STATE_TONE[row.state]}>{row.state}</Badge>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
          <div style={{ height: 2, background: GRAD_CREST }} />
          <div style={{ padding: '11px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em', fontSize: 'var(--text-title-m)', color: 'var(--text-gold)', flex: 1 }}>Recipes nobody knows</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>{gapRecipes.length} uncovered</span>
          </div>
          {gapRecipes.map((g) => (
            <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{g.name}</span>
              <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)', textAlign: 'right' }}>{g.profession}</span>
            </div>
          ))}
          {gapRecipes.length === 0 && (
            <div style={{ padding: '26px 18px', textAlign: 'center', color: 'var(--accent-verdant)', fontSize: 'var(--text-body-s)' }}>
              Full coverage for {gapExpansion} — every tracked recipe has at least one crafter.
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
          <div
            style={{
              padding: '11px 18px',
              background: 'var(--grad-header)',
              borderBottom: '1px solid var(--border-soft)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '.05em',
              fontSize: 'var(--text-title-m)',
              color: 'var(--text-gold)',
            }}
          >
            Close to max
          </div>
          {nearMax.map((n) => (
            <div key={`${n.characterName}-${n.profession}`} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 62px', gap: 12, padding: '7px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-strong)' }}>{n.characterName}</span>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{n.profession}</span>
              <span style={{ height: 5, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                <span style={{ display: 'block', height: '100%', width: `${n.skill}%`, background: 'var(--grad-gold)' }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-gold)', textAlign: 'right' }}>{n.skill}/100</span>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
          <div style={{ padding: '11px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em', fontSize: 'var(--text-title-m)', color: 'var(--text-gold)', flex: 1 }}>Stalled</span>
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Low skill · quiet 14+ days</span>
          </div>
          {stalled.map((n) => (
            <div key={`${n.characterName}-${n.profession}`} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 62px', gap: 12, padding: '7px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-body)' }}>{n.characterName}</span>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{n.profession}</span>
              <span style={{ height: 5, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                <span style={{ display: 'block', height: '100%', width: `${n.skill}%`, background: 'var(--accent-ember)' }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)', textAlign: 'right' }}>{n.skill}/100</span>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
          <div
            style={{
              padding: '11px 18px',
              background: 'var(--grad-header)',
              borderBottom: '1px solid var(--border-soft)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '.05em',
              fontSize: 'var(--text-title-m)',
              color: 'var(--text-gold)',
            }}
          >
            Request board summary
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hairline)' }}>
            <div style={{ flex: 1, padding: '14px 18px', borderRight: '1px solid var(--border-hairline)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--text-gold)', lineHeight: 1 }}>{requestSummary.open}</div>
              <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Open</div>
            </div>
            <div style={{ flex: 1, padding: '14px 18px', borderRight: '1px solid var(--border-hairline)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--accent-verdant)', lineHeight: 1 }}>{requestSummary.fulfilled}</div>
              <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Fulfilled</div>
            </div>
            <div style={{ flex: 1, padding: '14px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--text-strong)', lineHeight: 1 }}>{requestSummary.oldestOpenDays}</div>
              <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Oldest open (days)</div>
            </div>
          </div>
          {requestSummary.byProfessionDemand.map((d) => (
            <div key={d.profession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 56px', gap: 12, padding: '7px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{d.profession}</span>
              <span style={{ height: 5, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                <span style={{ display: 'block', height: '100%', width: `${d.sharePercent}%`, background: 'var(--accent-azure)' }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)', textAlign: 'right' }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
