import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { RefreshButton } from '../shared/RefreshButton';
import { HelpTooltip } from '../../design-system/HelpTooltip';
import { specIcon } from '../../scoring/specIcons';
import type { Role } from '../../scoring/types';
import type { AddonCalendar, CalendarEvent, MplusCharacter, MplusGuild } from '../../electron';
import type { MythicPlusRun } from '../../scoring/types';
import { useMythicPlus } from './useMythicPlus';
import { buildComps, DEFAULT_GROUP_FILTERS, eventAvailability, filterGuildGroups, findGuildGroups, isTimingGroup, keyRoles, roleRisk, type Comp, type GroupFilters, type CompMember, type GuildGroup, type Placed, type RoleRisk } from './mplusComp';

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
      <UtilityRow utility={comp.utility} />
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
    findings.push({ tone: 'warning', text: `${flexHeld} of the ${risk.groups} groups only ${flexHeld === 1 ? 'exists' : 'exist'} because someone plays a role they don't usually key as. With main roles only: ${risk.mainRoleGroups}.` });
  }
  for (const [label, who] of [['lust', risk.lust], ['a battle res', risk.bres]] as const) {
    if (risk.groups > 0 && who.length < risk.groups) {
      findings.push({ tone: 'danger', text: `Only ${who.length} ${who.length === 1 ? 'person' : 'people'} can bring ${label}${who.length ? ` (${who.join(', ')})` : ''} -- ${risk.groups - who.length} of the ${risk.groups} groups will go without.` });
    }
  }
  if (risk.critical.length && risk.critical.length === risk.people) {
    findings.push({ tone: 'warning', text: `No one to spare: exactly ${risk.groups * 5} people for ${risk.groups} groups, so anyone missing costs a group.` });
  } else if (risk.critical.length > 8) {
    findings.push({ tone: 'warning', text: `${risk.critical.length} people can't be spared -- if any one of them is out, you lose a group. Mostly: ${names(risk.critical.slice(0, 6))}, …` });
  } else if (risk.critical.length) {
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
          Enough for <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-gold)' }}>{risk.groups}</span> full group{risk.groups === 1 ? '' : 's'}.{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            Lust: {risk.lust.length} {risk.lust.length === 1 ? 'person' : 'people'} · Battle res: {risk.bres.length}
          </span>
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

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS: Array<{ label: string; days: number | null }> = [
  { label: 'All season', days: null },
  { label: 'Last 4 weeks', days: 28 },
  { label: 'Last 2 weeks', days: 14 },
];
const MIN_KEYS = [1, 2, 3, 5];
const MIN_LEVELS = [0, 5, 8, 10, 12];

const selectStyle = {
  padding: '7px 10px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-raised)',
  color: 'var(--text-body)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-body-s)',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="crd-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function GroupFilterBar({ members, filters, onChange, shown }: { members: CompMember[]; filters: GroupFilters; onChange: (f: GroupFilters) => void; shown: number }) {
  const set = (patch: Partial<GroupFilters>) => onChange({ ...filters, ...patch });
  const dungeons = useMemo(() => [...new Set(members.flatMap((m) => m.runs.map((r) => r.dungeon)))].sort(), [members]);
  const raiders = useMemo(() => members.map((m) => m.name).sort((a, b) => a.localeCompare(b)), [members]);
  // The period is stored as a date, so remember which option picked it.
  const [periodDays, setPeriodDays] = useState<number | null>(null);
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_GROUP_FILTERS);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
      <Field label="Raider">
        <select style={selectStyle} value={filters.raider ?? ''} onChange={(e) => set({ raider: e.target.value || null })}>
          <option value="">Anyone</option>
          {raiders.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Keys together">
        <select style={selectStyle} value={filters.minKeys} onChange={(e) => set({ minKeys: Number(e.target.value) })}>
          {MIN_KEYS.map((n) => (
            <option key={n} value={n}>
              {n}+
            </option>
          ))}
        </select>
      </Field>
      <Field label="Period">
        <select
          style={selectStyle}
          value={periodDays ?? ''}
          onChange={(e) => {
            const days = e.target.value ? Number(e.target.value) : null;
            setPeriodDays(days);
            set({ since: days === null ? null : new Date(Date.now() - days * DAY_MS).toISOString() });
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.label} value={p.days ?? ''}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Key level">
        <select style={selectStyle} value={filters.minLevel} onChange={(e) => set({ minLevel: Number(e.target.value) })}>
          {MIN_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === 0 ? 'Any' : `+${l} and up`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Dungeon">
        <select style={selectStyle} value={filters.dungeon ?? ''} onChange={(e) => set({ dungeon: e.target.value || null })}>
          <option value="">All dungeons</option>
          {dungeons.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
        <span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{shown}</span> group{shown === 1 ? '' : 's'}
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              setPeriodDays(null);
              onChange(DEFAULT_GROUP_FILTERS);
            }}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--text-gold)', font: 'inherit' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

interface SourceChar {
  name: string;
  class: string;
  spec: string;
  role: Role;
  rio: number;
  runs: MythicPlusRun[];
  seasonKeys: number | null;
  person?: string;
  typed?: boolean;
}

function fromMplus(c: MplusCharacter): SourceChar {
  return { name: c.name, class: c.class, spec: c.spec, role: c.role, rio: c.rioCurrent, runs: c.mythicPlusSeasonRuns, seasonKeys: c.mythicPlusSeasonKeys, person: c.person };
}

// Characters an officer added by name stay on this PC between visits -- a convenience, so
// it's fine if the browser storage isn't there.
const ADDED_KEY = 'mplusComp.added';
function loadAdded(): MplusCharacter[] {
  try {
    const raw = localStorage.getItem(ADDED_KEY);
    return raw ? (JSON.parse(raw) as MplusCharacter[]) : [];
  } catch {
    return [];
  }
}
function saveAdded(chars: MplusCharacter[]): void {
  try {
    localStorage.setItem(ADDED_KEY, JSON.stringify(chars));
  } catch {
    // not saved; they'd just type it again
  }
}

/** "Name", "Name-Realm" or "Name-RealmWithoutSpaces" (as the calendar writes it) -> name + realm. */
export function parseCharacter(input: string): { name: string; realm: string | null } {
  const [name, ...rest] = input.trim().split('-');
  const realm = rest.join('-').trim();
  return { name: name.trim(), realm: realm ? realm.replace(/([a-z])([A-Z])/g, '$1 $2') : null };
}

function eventKeyOf(e: CalendarEvent): string {
  return `${e.start}|${e.title}`;
}

function eventLabel(e: CalendarEvent): string {
  const [date, time] = e.start.split('T');
  const day = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const coming = e.invites?.filter((i) => i.answer === 'coming').length;
  return `${day} ${time} · ${e.title}${coming !== undefined ? ` (${coming} coming)` : ''}`;
}

function ageText(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)} days ago`;
}

function EventPicker({
  calendar,
  eventKey,
  onPick,
  includeMaybe,
  onIncludeMaybe,
  selected,
  result,
  onLookUp,
}: {
  calendar: AddonCalendar | null;
  eventKey: string;
  onPick: (key: string) => void;
  includeMaybe: boolean;
  onIncludeMaybe: (v: boolean) => void;
  selected: CalendarEvent | null;
  result: ReturnType<typeof eventAvailability> | null;
  onLookUp: (names: string[]) => Promise<void>;
}) {
  const [lookingUp, setLookingUp] = useState(false);
  if (!calendar) {
    return (
      <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 720 }}>
        No calendar yet. In game, with the Guild Tools Loot TEST addon on, type <code>/gtloottest calendar</code>, then <code>/reload</code>. Until then, pick who's available by hand below.
      </div>
    );
  }
  const upcoming = calendar.events.filter((e) => e.start >= new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 16));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <select style={{ ...selectStyle, minWidth: 320 }} value={eventKey} onChange={(e) => onPick(e.target.value)}>
          <option value="">No event -- everyone</option>
          {upcoming.map((e) => (
            <option key={eventKeyOf(e)} value={eventKeyOf(e)}>
              {eventLabel(e)}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeMaybe} onChange={(e) => onIncludeMaybe(e.target.checked)} />
          Count tentative as coming
        </label>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
          Calendar read {ageText(calendar.scannedAt)} · {upcoming.length} upcoming event{upcoming.length === 1 ? '' : 's'}
        </span>
      </div>
      {selected && !selected.invites && (
        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--status-warning)' }}>No sign-up list for this event ({selected.note ?? 'none saved'}), so everyone is shown.</div>
      )}
      {result && (
        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--text-strong)' }}>{result.coming.length}</span> on the M+ list coming
          {result.maybe.length > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--status-warning)' }}>
                tentative: {result.maybe.join(', ')}
                {includeMaybe ? ' (counted)' : ' (not counted)'}
              </span>
            </>
          )}
          {result.extra.length > 0 && (
            <>
              {' · '}also coming, not in the pool yet: {result.extra.join(', ')}{' '}
              <button
                type="button"
                disabled={lookingUp}
                onClick={async () => {
                  setLookingUp(true);
                  const full = new Map((selected?.invites ?? []).map((i) => [i.name, i.fullName]));
                  await onLookUp(result.extra.map((n) => full.get(n) ?? n));
                  setLookingUp(false);
                }}
                style={{ background: 'none', border: 0, padding: 0, cursor: lookingUp ? 'wait' : 'pointer', color: 'var(--text-gold)', font: 'inherit' }}
              >
                {lookingUp ? 'looking them up…' : 'Look them up'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddCharacter({ onAdd, poolNote }: { onAdd: (input: string) => Promise<string | null>; poolNote: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    const err = await onAdd(text);
    setBusy(false);
    if (err) setMessage(err);
    else {
      setMessage(`Added ${text.trim()}.`);
      setText('');
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 'var(--text-body-s)' }}>
      <input
        type="text"
        placeholder="Add someone: Name or Name-Realm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        style={{ ...selectStyle, minWidth: 260 }}
      />
      <button type="button" onClick={() => void submit()} disabled={busy || !text.trim()} className="crd-btn" style={{ ...selectStyle, cursor: busy ? 'wait' : 'pointer', color: 'var(--text-gold)' }}>
        {busy ? 'Looking up… (a few seconds)' : 'Add'}
      </button>
      {message && <span style={{ color: message.startsWith('Added') ? 'var(--status-success)' : 'var(--status-warning)' }}>{message}</span>}
      <span style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{poolNote}</span>
    </div>
  );
}

function UtilityRow({ utility }: { utility: Comp['utility'] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {utility.utilities.map((u) => {
        const have = u.by.length > 0;
        const key = u.id === 'lust' || u.id === 'bres';
        return (
          <span
            key={u.id}
            title={have ? u.by.map((b) => `${b.name}: ${b.ability}`).join('\n') : `Nobody in this group brings ${u.label.toLowerCase()}`}
            style={{
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${have ? 'var(--border-hairline)' : key ? 'var(--status-danger)' : 'var(--border-hairline)'}`,
              fontSize: 'var(--text-micro)',
              color: have ? 'var(--text-body)' : key ? 'var(--status-danger)' : 'var(--text-faint)',
              textDecoration: have ? 'none' : 'line-through',
              fontWeight: key ? 600 : 400,
            }}
          >
            {have ? '✓ ' : '✗ '}
            {u.label}
          </span>
        );
      })}
      {utility.buffs.length > 0 && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', alignSelf: 'center' }}>Buffs: {utility.buffs.join(', ')}</span>}
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
  const [calendar, setCalendar] = useState<AddonCalendar | null>(null);
  const [eventKey, setEventKey] = useState('');
  const [includeMaybe, setIncludeMaybe] = useState(false);
  useEffect(() => {
    void window.electronAPI?.getAddonCalendar?.().then(setCalendar);
  }, []);
  const selectedEvent = calendar?.events.find((e) => eventKeyOf(e) === eventKey) ?? null;

  // Who's in the pool: every guild member with keys this season (the proxy rebuilds that
  // list in the background, see mplusGuild.cjs), falling back to the raid roster until the
  // first list exists -- plus anyone an officer typed in.
  const [guild, setGuild] = useState<MplusGuild | null>(null);
  const [added, setAdded] = useState<MplusCharacter[]>(loadAdded);
  useEffect(() => {
    void window.electronAPI?.getMplusGuild?.().then(setGuild);
  }, []);
  useEffect(() => saveAdded(added), [added]);
  const source: SourceChar[] = useMemo(() => {
    const base: SourceChar[] = guild?.characters.length
      ? guild.characters.map(fromMplus)
      : mp.rows.map((r) => ({ name: r.name, class: r.class, spec: r.spec, role: r.role, rio: r.rioCurrent, runs: r.seasonRuns, seasonKeys: r.seasonKeys }));
    const names = new Set(base.map((c) => c.name.toLowerCase()));
    return [...base, ...added.filter((a) => !names.has(a.name.toLowerCase())).map((a) => ({ ...fromMplus(a), typed: true }))];
  }, [guild, mp.rows, added]);

  // Only characters who've actually keyed this season -- a 0-score character isn't an M+ pick.
  const members: CompMember[] = useMemo(
    () =>
      source
        .filter((r) => r.rio > 0 || r.runs.length > 0)
        .map((r) => ({ name: r.name, class: r.class, roles: keyRoles(r.runs, { role: r.role, spec: r.spec }), rio: Math.round(r.rio), runs: r.runs, person: r.person })),
    [source],
  );
  // How much of the season we can actually see -- Raider.IO doesn't list every key (see mplusRunArchive.cjs).
  const coverage = useMemo(() => {
    const counted = source.filter((r) => r.seasonKeys !== null);
    if (!counted.length) return null;
    return { seen: counted.reduce((s, r) => s + Math.min(r.runs.length, r.seasonKeys!), 0), total: counted.reduce((s, r) => s + r.seasonKeys!, 0) };
  }, [source]);
  const typedNames = useMemo(() => new Set(source.filter((c) => c.typed).map((c) => c.name)), [source]);
  const addCharacter = async (input: string): Promise<string | null> => {
    const { name, realm } = parseCharacter(input);
    if (!name) return 'Type a character name, or Name-Realm.';
    const found = await window.electronAPI?.lookupMplusCharacter?.(name, realm ?? undefined);
    if (!found) return `Raider.IO doesn't know ${input.trim()}${realm ? '' : ' on the guild realm -- try Name-Realm'}.`;
    setAdded((prev) => [...prev.filter((a) => a.key !== found.key), found]);
    return null;
  };
  const groups = useMemo(() => findGuildGroups(members), [members]);
  const available = useMemo(() => members.filter((m) => !away.has(m.name)), [members, away]);
  const { comps, bench } = useMemo(() => buildComps(available, groups), [available, groups]);
  const risk = useMemo(() => roleRisk(available), [available]);
  const [filters, setFilters] = useState<GroupFilters>(DEFAULT_GROUP_FILTERS);
  const shownGroups = useMemo(() => filterGuildGroups(members, filters), [members, filters]);
  const timing = shownGroups.filter(isTimingGroup);
  const notTiming = shownGroups.filter((g) => !isTimingGroup(g));

  const eventResult = useMemo(
    () => (selectedEvent?.invites ? eventAvailability(members.map((m) => m.name), selectedEvent.invites, includeMaybe) : null),
    [selectedEvent, members, includeMaybe],
  );
  // Picking an event (or changing whether tentative counts) resets who's available to its sign-ups;
  // clicking people afterwards still adjusts from there.
  useEffect(() => {
    setAway(eventResult ? new Set(eventResult.away) : new Set());
  }, [eventResult]);

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
            <SectionTitle help="Upcoming events from the in-game calendar, read by the Guild Tools Loot TEST addon (it reads the calendar when you log in, or when you type /gtloottest calendar, and Guild Tools sees it after a /reload or logout). Picking one marks everyone who hasn't accepted or signed up as unavailable.">Event</SectionTitle>
            <EventPicker
              calendar={calendar}
              eventKey={eventKey}
              onPick={setEventKey}
              includeMaybe={includeMaybe}
              onIncludeMaybe={setIncludeMaybe}
              selected={selectedEvent}
              result={eventResult}
              onLookUp={async (names) => {
                for (const n of names) await addCharacter(n);
              }}
            />

            <SectionTitle help="Every guild member with keys this season (plus anyone added by name). Click someone to leave them out, say for tonight. Groups rebuild straight away. The roles shown are every role they've keyed as this season, most-played first. Alts linked in the officers' alt list count as one person.">Who's available</SectionTitle>
            <AddCharacter onAdd={addCharacter} poolNote={guild?.characters.length ? `${members.length} with keys this season${guild.refreshing ? ' · updating the guild list…' : ''}` : guild?.refreshing ? 'Building the guild list (a few minutes the first time) -- showing the raid roster meanwhile.' : 'Showing the raid roster.'} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
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
                    {typedNames.has(m.name) && (
                      <span
                        role="button"
                        title="Remove -- added by name"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdded((prev) => prev.filter((a) => a.name !== m.name));
                        }}
                        style={{ marginLeft: 2, color: 'var(--text-gold)' }}
                      >
                        ×
                      </span>
                    )}
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

            <SectionTitle help="Narrows the two lists below. Period, key level and dungeon change which keys count, so each group's timed record is for the matching keys only. The suggested groups above always use the whole season.">Guild groups</SectionTitle>
            <GroupFilterBar members={members} filters={filters} onChange={setFilters} shown={shownGroups.length} />

            <SectionTitle help="Two or more raiders who were in the same key, grouped by exactly who was there. At least half their keys timed. Click a row for the keys.">Timing keys ({timing.length})</SectionTitle>
            <GroupList groups={timing} empty="No guild group matching these filters has timed at least half its keys." />

            <SectionTitle help="Same as above, but fewer than half of these groups' keys were timed. Click a row for the keys.">Not timing keys ({notTiming.length})</SectionTitle>
            <GroupList groups={notTiming} empty="Every guild group matching these filters is timing at least half its keys." />
          </>
        )}
      </div>
    </div>
  );
}
