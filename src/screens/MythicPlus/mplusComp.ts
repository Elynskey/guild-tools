import type { MythicPlusRun, Role } from '../../scoring/types';

/** A role someone has played in recent keys, the spec they played it as, and how many keys. */
export interface KeyRole {
  role: Role;
  spec: string;
  keys: number;
}

export interface CompMember {
  name: string;
  class: string;
  /** Every role they've keyed as recently, most-played first -- see keyRoles. */
  roles: KeyRole[];
  rio: number;
  runs: MythicPlusRun[];
}

/** A member in a comp slot, and whether that slot isn't the role they key as most. */
export interface Placed {
  member: CompMember;
  spec: string;
  offRole: boolean;
}

/** One guild key, with who played what in it -- from each raider's own Raider.IO record of the key. */
export interface GroupRun extends MythicPlusRun {
  lineup: Array<{ name: string; role: Role | null; spec: string | null }>;
}

/** A set of 2+ raiders who were in the same key together, and how those keys went. */
export interface GuildGroup {
  /** Sorted, so the same people always make the same group. */
  members: string[];
  /** Newest first. */
  runs: GroupRun[];
  timed: number;
  /** Highest key level this group timed together, or null if they never did. */
  bestTimed: number | null;
  lastRunAt: string;
}

export interface PairRecord {
  runs: number;
  timed: number;
}

export interface Comp {
  tank: Placed;
  healer: Placed;
  dps: Placed[];
  avgRio: number;
  /** Median of the members' best timed key in their recent runs -- a level this group can realistically aim for. Null when nobody has timed anything recently. */
  targetLevel: number | null;
  /** Every pair in the comp that has keyed together, best record first. */
  history: Array<{ a: string; b: string } & PairRecord>;
}

/**
 * Every role a raider has played in their recent keys, most-played first (ties go to the
 * most recent key), each with the spec they last played it as. Keys can be any role --
 * a raid healer who also keys as DPS, a raid tank who keys as Havoc -- so this, not the
 * raid role, decides which slots they can fill. Falls back to the raid role/spec when
 * no run records a role.
 */
export function keyRoles(runs: MythicPlusRun[], fallback: { role: Role; spec: string }): KeyRole[] {
  const byRole = new Map<Role, KeyRole>();
  for (const r of runs) {
    if (!r.role) continue;
    const k = byRole.get(r.role) ?? { role: r.role, spec: r.spec ?? fallback.spec, keys: 0 };
    k.keys++;
    byRole.set(r.role, k);
  }
  if (!byRole.size) return [{ ...fallback, keys: 0 }];
  return [...byRole.values()].sort((a, b) => b.keys - a.keys); // stable: insertion order is newest-first
}

/** A group times keys when at least half its shared keys were timed. */
export function isTimingGroup(g: GuildGroup): boolean {
  return g.timed * 2 >= g.runs.length;
}

/**
 * Two raiders whose runs share an id (dungeon + completion time + level -- see
 * mplusRunArchive.cjs) were in that key together. Covers the season as far as the
 * archive does. Runs without an id (sample data) can't be matched and are skipped.
 */
export function findGuildGroups(members: CompMember[]): GuildGroup[] {
  const byId = new Map<string, { run: MythicPlusRun; who: GroupRun['lineup'] }>();
  for (const m of members) {
    for (const run of m.runs) {
      if (!run.id) continue;
      const entry = byId.get(run.id) ?? { run, who: [] };
      // Prefer a copy with a Raider.IO link for the group's own record of the key.
      if (!entry.run.url && run.url) entry.run = run;
      entry.who.push({ name: m.name, role: run.role ?? null, spec: run.spec ?? null });
      byId.set(run.id, entry);
    }
  }

  const groups = new Map<string, GuildGroup>();
  for (const { run, who } of byId.values()) {
    if (who.length < 2) continue;
    const names = who.map((w) => w.name).sort();
    const key = names.join('|');
    const g = groups.get(key) ?? { members: names, runs: [], timed: 0, bestTimed: null, lastRunAt: run.completedAt };
    const order: Record<Role, number> = { tank: 0, healer: 1, dps: 2 };
    const lineup = [...who].sort((a, b) => (a.role ? order[a.role] : 3) - (b.role ? order[b.role] : 3) || a.name.localeCompare(b.name));
    g.runs.push({ ...run, lineup });
    if (run.upgrades > 0) {
      g.timed++;
      g.bestTimed = Math.max(g.bestTimed ?? 0, run.level);
    }
    if (run.completedAt > g.lastRunAt) g.lastRunAt = run.completedAt;
    groups.set(key, g);
  }

  for (const g of groups.values()) g.runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return [...groups.values()].sort((a, b) => b.runs.length - a.runs.length || b.lastRunAt.localeCompare(a.lastRunAt));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every two raiders who shared a key, however many other guildies were with them. */
export function pairRecords(groups: GuildGroup[]): Map<string, PairRecord> {
  const pairs = new Map<string, PairRecord>();
  for (const g of groups) {
    for (let i = 0; i < g.members.length; i++) {
      for (let j = i + 1; j < g.members.length; j++) {
        const k = pairKey(g.members[i], g.members[j]);
        const p = pairs.get(k) ?? { runs: 0, timed: 0 };
        p.runs += g.runs.length;
        p.timed += g.timed;
        pairs.set(k, p);
      }
    }
  }
  return pairs;
}

// How much a pair's shared history counts next to Raider.IO score. A pair that timed
// every key together is worth roughly a third of the roster's top score; one that
// depleted everything costs the same. Few shared keys count for less (a 1/1 is luck).
const SYNERGY_WEIGHT = 0.6;

function synergy(pairs: Map<string, PairRecord>, a: string, b: string): number {
  const p = pairs.get(pairKey(a, b));
  if (!p) return 0;
  const rate = (p.timed + 1) / (p.runs + 2); // pulled toward 50% when there are few keys
  const confidence = Math.min(p.runs, 4) / 4;
  return (rate - 0.5) * confidence;
}

function bestTimedLevel(m: CompMember): number | null {
  const timed = m.runs.filter((r) => r.upgrades > 0).map((r) => r.level);
  return timed.length ? Math.max(...timed) : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

// Playing a role you don't usually key as costs about 15% of the top score -- enough that
// a main-role raider of similar score wins the slot, not so much that a group is left
// without a tank when someone who's tanked keys before is available.
const OFF_ROLE_PENALTY = 0.15;

const SLOTS: Role[] = ['tank', 'healer', 'dps', 'dps', 'dps'];
const ROLES: Role[] = ['tank', 'healer', 'dps'];

function roleOf(m: CompMember, role: Role): KeyRole | undefined {
  return m.roles.find((r) => r.role === role);
}

/**
 * Can these raiders fill these slots, one raider per slot? With only three roles this is
 * exact and cheap: it's possible exactly when, for every combination of roles, enough
 * raiders can play at least one of them to cover those roles' slots combined (Hall).
 */
function canFill(pool: CompMember[], slots: Role[]): boolean {
  for (let mask = 1; mask < 1 << ROLES.length; mask++) {
    const roles = ROLES.filter((_, i) => mask & (1 << i));
    const needed = slots.filter((s) => roles.includes(s)).length;
    const able = pool.filter((m) => roles.some((r) => roleOf(m, r))).length;
    if (able < needed) return false;
  }
  return true;
}

function groupSlots(count: number): Role[] {
  return Array.from({ length: count }, () => SLOTS).flat();
}

/**
 * Greedy, strongest group first, filling tank, then healer, then three DPS. Each slot
 * goes to whoever fits it best: their score, how keys went when they ran with the people
 * already in, and a small cost for a role they don't key as most. It first works out how
 * many full groups the available raiders can make, and never makes a pick that would cost
 * one -- so a raider who can tank isn't spent on DPS in group 1 when group 3 needs a tank.
 */
export function buildComps(members: CompMember[], groups: GuildGroup[]): { comps: Comp[]; bench: CompMember[] } {
  const pairs = pairRecords(groups);
  const maxRio = Math.max(1, ...members.map((m) => m.rio));
  let pool = [...members].sort((a, b) => b.rio - a.rio);

  const fit = (m: CompMember, role: Role, team: Placed[]) =>
    m.rio / maxRio -
    (m.roles[0].role === role ? 0 : OFF_ROLE_PENALTY) +
    SYNERGY_WEIGHT * team.reduce((sum, t) => sum + synergy(pairs, m.name, t.member.name), 0);

  let groupCount = 0;
  while (canFill(pool, groupSlots(groupCount + 1))) groupCount++;

  const comps: Comp[] = [];
  for (let g = 0; g < groupCount; g++) {
    const team: Placed[] = [];
    SLOTS.forEach((role, i) => {
      const rest = [...SLOTS.slice(i + 1), ...groupSlots(groupCount - g - 1)];
      let best: CompMember | null = null;
      for (const c of pool) {
        if (!roleOf(c, role) || !canFill(pool.filter((m) => m !== c), rest)) continue;
        if (!best || fit(c, role, team) > fit(best, role, team)) best = c;
      }
      // The remaining slots were fillable before this pick, so some candidate keeps them so.
      pool = pool.filter((m) => m !== best);
      team.push({ member: best!, spec: roleOf(best!, role)!.spec, offRole: best!.roles[0].role !== role });
    });

    const history: Comp['history'] = [];
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const p = pairs.get(pairKey(team[i].member.name, team[j].member.name));
        if (p) history.push({ a: team[i].member.name, b: team[j].member.name, ...p });
      }
    }
    history.sort((x, y) => y.timed / y.runs - x.timed / x.runs || y.runs - x.runs);

    const [tank, healer, ...dps] = team;
    comps.push({
      tank,
      healer,
      dps,
      avgRio: Math.round(team.reduce((s, t) => s + t.member.rio, 0) / team.length),
      targetLevel: median(team.map((t) => bestTimedLevel(t.member)).filter((l): l is number => l !== null)),
      history,
    });
  }

  return { comps, bench: pool };
}

/** How many full groups (tank, healer, three DPS) these raiders can make. */
export function maxGroups(pool: CompMember[]): number {
  let n = 0;
  while (canFill(pool, groupSlots(n + 1))) n++;
  return n;
}

export interface RoleCoverage {
  role: Role;
  /** Key this role more than any other. */
  main: CompMember[];
  /** Have keyed this role, but it isn't their most-played one. */
  flex: CompMember[];
}

export interface RoleRisk {
  coverage: RoleCoverage[];
  groups: number;
  /** Groups if nobody plays anything but their main role -- the gap to `groups` is what flex players are holding up. */
  mainRoleGroups: number;
  /** Roles that stop there being one more group, and how many more players of that role it would take (null: more of this role alone wouldn't do it). */
  short: Array<{ role: Role; need: number }>;
  /** Raiders whose absence alone costs a whole group. */
  critical: CompMember[];
}

function hypothetical(role: Role, i: number): CompMember {
  return { name: `__extra-${role}-${i}`, class: '', roles: [{ role, spec: '', keys: 0 }], rio: 0, runs: [] };
}

/** What the roster is short on for Mythic+ groups, and who it can't do without. */
export function roleRisk(members: CompMember[]): RoleRisk {
  const groups = maxGroups(members);
  const coverage = ROLES.map((role) => ({
    role,
    main: members.filter((m) => m.roles[0].role === role),
    flex: members.filter((m) => m.roles[0].role !== role && roleOf(m, role)),
  }));
  const mainRoleGroups = maxGroups(members.map((m) => ({ ...m, roles: [m.roles[0]] })));

  const short: RoleRisk['short'] = [];
  for (const role of ROLES) {
    // One more group needs at most 3 more of any role.
    let need: number | null = null;
    for (let k = 1; k <= 3 && need === null; k++) {
      const extra = Array.from({ length: k }, (_, i) => hypothetical(role, i));
      if (maxGroups([...members, ...extra]) > groups) need = k;
    }
    if (need !== null) short.push({ role, need });
  }
  short.sort((a, b) => a.need - b.need);

  const critical = groups === 0 ? [] : members.filter((m) => maxGroups(members.filter((x) => x !== m)) < groups);
  return { coverage, groups, mainRoleGroups, short, critical };
}
