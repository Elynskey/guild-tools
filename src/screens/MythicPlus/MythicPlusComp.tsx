import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { RefreshButton } from '../shared/RefreshButton';
import { HelpTooltip } from '../../design-system/HelpTooltip';
import { specIcon } from '../../scoring/specIcons';
import type { Role } from '../../scoring/types';
import { useMythicPlus } from './useMythicPlus';
import { buildComps, findGuildGroups, isTimingGroup, keyRoles, roleRisk, type Comp, type CompMember, type GuildGroup, type Placed, type RoleRisk } from './mplusComp';

const ROLE_LABEL: Record<Role, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };

function rolesLabel(m: CompMember): string {
  return m.roles.map((r) => ROLE_LABEL[r.role]).join(' / ');
}

function rateColor(timed: number, runs: number): string {
  const rate = timed / runs;
  if (rate >= 0.75) return 'var(--status-success)';
  if (rate >= 0.5) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

function Record({ timed, runs }: { timed: number; runs: number }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', color: rateColor(timed, runs), whiteSpace: 'nowrap' }}>
      {timed}/{runs} timed
    </span>
  );
}

function SectionTitle({ children, help }: { children: ReactNode; help: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '32px 0 12px', fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-m)', fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-strong)' }}>
      {children}
      <HelpTooltip text={help} />
    </div>
  );
}

function MemberLine({ p, slot }: { p: Placed; slot: Role }) {
  const m = p.member;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <img src={specIcon(p.spec, m.class)} alt="" style={{ width: 22, height: 22, borderRadius: 2, border: '1px solid var(--border-hairline)' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{m.name}</div>
        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
          {ROLE_LABEL[slot]} · {p.spec} {m.class}
          {p.offRole && (
            <span style={{ color: 'var(--status-warning)' }} title={`Has played ${ROLE_LABEL[slot]} in ${m.roles.find((r) => r.role === slot)?.keys ?? 0} of their keys this season`}>
              {' '}· usually {ROLE_LABEL[m.roles[0].role]}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-gold)' }}>{m.rio}</span>
    </div>
  );
}

function CompCard({ comp, index }: { comp: Comp; index: number }) {
  return (
    <div className="crd-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-m)', fontWeight: 600, color: 'var(--text-strong)' }}>Group {index + 1}</div>
        <div style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
          avg <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-gold)' }}>{comp.avgRio}</span>
          {comp.targetLevel !== null && (
            <>
              {' · aim for '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>+{comp.targetLevel}</span>
            </>
          )}
        </div>
      </div>
      <div>
        <MemberLine p={comp.tank} slot="tank" />
        <MemberLine p={comp.healer} slot="healer" />
        {comp.dps.map((d) => (
          <MemberLine key={d.member.name} p={d} slot="dps" />
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 10, fontSize: 'var(--text-body-s)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {comp.history.length === 0 ? (
          <span style={{ color: 'var(--text-faint)' }}>No one here has keyed together recently.</span>
        ) : (
          comp.history.map((h) => (
            <div key={`${h.a}|${h.b}`} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {h.a} + {h.b}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Record timed={h.timed} runs={h.runs} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const PLURAL: Record<Role, string> = { tank: 'tanks', healer: 'healers', dps: 'DPS' };

function names(ms: CompMember[]): string {
  return ms.map((m) => m.name).join(', ');
}

function RoleRiskPanel({ risk }: { risk: RoleRisk }) {
  const flexHeld = risk.groups - risk.mainRoleGroups;
  const findings: Array<{ tone: 'danger' | 'warning' | 'muted'; text: string }> = [];
  if (risk.groups === 0) findings.push({ tone: 'danger', text: 'Not enough available raiders for a single full group.' });
  for (const s of risk.short) {
    findings.push({
      tone: s === risk.short[0] ? 'danger' : 'warning',
      text: `Short on ${PLURAL[s.role]}: ${s.need} more ${s.need === 1 ? (s.role === 'dps' ? 'DPS' : s.role) : PLURAL[s.role]} would make group ${risk.groups + 1}.`,
    });
  }
  if (flexHeld > 0) {
    findings.push({ tone: 'warning', text: `${flexHeld} of the ${risk.groups} groups only exist because someone plays a role they don't usually key as. With main roles only: ${risk.mainRoleGroups}.` });
  }
  if (risk.critical.length) {
    findings.push({ tone: 'warning', text: `Can't do without: ${names(risk.critical)} -- if any one of them is out, you lose a group.` });
  }

  const toneColor = { danger: 'var(--status-danger)', warning: 'var(--status-warning)', muted: 'var(--text-muted)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {risk.coverage.map((c) => {
          const isShort = risk.short[0]?.role === c.role;
          return (
            <div key={c.role} className="crd-card" style={{ padding: 16, border: isShort ? '1px solid var(--status-danger)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-m)', fontWeight: 600, color: 'var(--text-strong)' }}>{ROLE_LABEL[c.role]}</div>
                <div style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{c.main.length}</span> main
                  {c.flex.length > 0 && (
                    <>
                      {' + '}
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{c.flex.length}</span> flex
                    </>
                  )}
                  {' · '}
                  {c.role === 'dps' ? 3 : 1} per group
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>{c.main.length ? names(c.main) : <span style={{ color: 'var(--text-faint)' }}>Nobody</span>}</div>
              {c.flex.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 'var(--text-micro)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                  Flex: {c.flex.map((m) => `${m.name} (${m.roles.find((r) => r.role === c.role)?.keys ?? 0} of ${m.roles.reduce((s, r) => s + r.keys, 0)} keys)`).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-body-s)' }}>
        <div style={{ color: 'var(--text-strong)' }}>
          Enough for <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-gold)' }}>{risk.groups}</span> full group{risk.groups === 1 ? '' : 's'}.
        </div>
        {findings.map((f, i) => (
          <div key={i} style={{ color: toneColor[f.tone] }}>
            {f.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupRow({ g }: { g: GuildGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border-hairline)' }}>
      <div
        className="raider-row"
        onClick={() => setOpen(!open)}
        style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 90px', gap: 12, alignItems: 'center', padding: '9px 18px', cursor: 'pointer', fontSize: 'var(--text-body-s)' }}
      >
        <div style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{g.members.join(', ')}</div>
        <div style={{ textAlign: 'right' }}>
          <Record timed={g.timed} runs={g.runs.length} />
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{g.bestTimed !== null ? `best +${g.bestTimed}` : 'none timed'}</div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{g.lastRunAt.slice(0, 10)}</div>
      </div>
      {open && (
        <div style={{ padding: '8px 18px 12px 36px', background: 'var(--surface-raised)', boxShadow: 'var(--inset-well)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-body-s)' }}>
          {g.runs.map((r) => (
            <a key={r.id} href={r.url || undefined} target="_blank" rel="noreferrer" title={r.url ? 'Open on Raider.IO' : 'From the dungeon history on Raider.IO -- no run page for this key'} style={{ display: 'flex', gap: 10, borderBottom: 'none', textDecoration: 'none', cursor: r.url ? 'pointer' : 'default' }}>
              <span style={{ color: 'var(--text-strong)' }}>{r.dungeon}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>+{r.level}</span>
              <span style={{ color: r.upgrades > 0 ? 'var(--status-success)' : 'var(--text-faint)' }}>{r.upgrades > 0 ? `timed (+${r.upgrades})` : 'depleted'}</span>
              <span style={{ color: 'var(--text-muted)' }}>{r.lineup.map((w) => `${w.name} ${w.spec ?? (w.role ? ROLE_LABEL[w.role] : '')}`.trim()).join(' · ')}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{r.completedAt.slice(0, 10)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupList({ groups, empty }: { groups: GuildGroup[]; empty: string }) {
  if (!groups.length) return <div style={{ padding: 24, border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 'var(--text-body-s)' }}>{empty}</div>;
  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
      {groups.map((g) => (
        <GroupRow key={g.members.join('|')} g={g} />
      ))}
    </div>
  );
}

export function MythicPlusComp() {
  const mp = useMythicPlus();
  const [away, setAway] = useState<Set<string>>(new Set());

  // Only raiders who've actually keyed this season -- a 0-score character isn't an M+ pick.
  const members: CompMember[] = useMemo(
    () =>
      mp.rows
        .filter((r) => r.rioCurrent > 0 || r.runs.length > 0)
        .map((r) => ({ name: r.name, class: r.class, roles: keyRoles(r.seasonRuns, { role: r.role, spec: r.spec }), rio: Math.round(r.rioCurrent), runs: r.seasonRuns })),
    [mp.rows],
  );
  // How much of the season we can actually see -- Raider.IO doesn't list every key (see mplusRunArchive.cjs).
  const coverage = useMemo(() => {
    const counted = mp.rows.filter((r) => r.seasonKeys !== null);
    if (!counted.length) return null;
    return { seen: counted.reduce((s, r) => s + Math.min(r.seasonRuns.length, r.seasonKeys!), 0), total: counted.reduce((s, r) => s + r.seasonKeys!, 0) };
  }, [mp.rows]);
  const groups = useMemo(() => findGuildGroups(members), [members]);
  const available = useMemo(() => members.filter((m) => !away.has(m.name)), [members, away]);
  const { comps, bench } = useMemo(() => buildComps(available, groups), [available, groups]);
  const risk = useMemo(() => roleRisk(available), [available]);
  const timing = groups.filter(isTimingGroup);
  const notTiming = groups.filter((g) => !isTimingGroup(g));

  const toggle = (name: string) => {
    const next = new Set(away);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setAway(next);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                M+ Comp
                <HelpTooltip text="Suggested Mythic+ groups built from Raider.IO score and how keys went when these raiders ran together." />
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          <RefreshButton onRefresh={mp.refresh} refreshing={mp.refreshing} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Groups are one tank, one healer and three DPS, strongest first. Each pick weighs the raider's Raider.IO score against how keys went when they ran with the others. Raiders can fill any role they've played in keys this season (which may not be their raid role), with their most-played role preferred.
        </p>
        {!mp.loading && (
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
            {coverage ? (
              <>
                Seeing <span style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{coverage.seen}</span> of{' '}
                <span style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{coverage.total}</span> keys the roster has run this season ({Math.round((100 * coverage.seen) / Math.max(1, coverage.total))}%).
              </>
            ) : (
              'Only each raider’s last 10 keys are available right now.'
            )}{' '}
            <HelpTooltip text="Raider.IO doesn't list every key: only recent keys, dungeon bests, and the highest keys overall and this week and last week. Guild Tools keeps every key it sees, so this fills in as the season goes on." />
          </p>
        )}

        {mp.loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ marginTop: 24, padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>No one on the roster has a Mythic+ score this season.</div>
        ) : (
          <>
            <SectionTitle help="Click a raider to leave them out, say for tonight. Groups rebuild straight away; nothing is saved. The roles shown are every role they've keyed as recently, most-played first.">Who's available</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {members.map((m) => {
                const out = away.has(m.name);
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => toggle(m.name)}
                    title={out ? 'Left out -- click to add back' : 'Click to leave out'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 'var(--radius-sm)',
                      background: out ? 'transparent' : 'var(--surface-raised)',
                      color: out ? 'var(--text-faint)' : 'var(--text-body)',
                      textDecoration: out ? 'line-through' : 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 'var(--text-body-s)',
                    }}
                  >
                    <img src={specIcon(m.roles[0].spec, m.class)} alt="" style={{ width: 16, height: 16, borderRadius: 2, opacity: out ? 0.4 : 1 }} />
                    {m.name}
                    <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{rolesLabel(m)}</span>
                  </button>
                );
              })}
            </div>

            <SectionTitle help="From the available raiders: who can fill each role in a key, what stops there being another group, and who you can't do without. Flex means they've played that role in keys this season, just not most often.">Role coverage</SectionTitle>
            <RoleRiskPanel risk={risk} />

            <SectionTitle help="Built from the available raiders. Under each group: every pair in it who has run keys together this season, and how many of those keys they timed.">Suggested groups</SectionTitle>
            {comps.length === 0 ? (
              <div style={{ padding: 24, border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 'var(--text-body-s)' }}>
                Not enough available raiders for a full group -- each one needs a tank, a healer and three DPS.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {comps.map((c, i) => (
                  <CompCard key={c.tank.member.name} comp={c} index={i} />
                ))}
              </div>
            )}
            {bench.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
                Not placed: {bench.map((m) => `${m.name} (${rolesLabel(m)})`).join(', ')}
              </div>
            )}

            <SectionTitle help="Two or more raiders who were in the same key, grouped by exactly who was there. At least half their keys timed. Click a row for the keys.">Guild groups timing keys</SectionTitle>
            <GroupList groups={timing} empty="No guild group has timed at least half its keys recently." />

            <SectionTitle help="Same as above, but fewer than half of these groups' keys were timed. Click a row for the keys.">Guild groups not timing keys</SectionTitle>
            <GroupList groups={notTiming} empty="Every guild group is timing at least half its keys." />
          </>
        )}
      </div>
    </div>
  );
}
