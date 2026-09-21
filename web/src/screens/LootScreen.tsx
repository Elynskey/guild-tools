import { useMemo, useState } from 'react';
import { NEED_WIN_CAP, annotateWithTrades, buildSeasonLootReport, groupLootByNight, itemLabel, type LootEntry, type SeasonLootRow } from '../../../src/raid/lootLogic';
import type { LootPayload, ProfessionsPayload, RosterPayload } from '../api';
import type { Loaded } from '../useLoad';
import { clockLabel, dayLabel, shortName } from '../format';
import { LoadState } from '../ui';

type Sort = 'fewest' | 'most' | 'longest' | 'losses';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'fewest', label: 'Fewest Need wins' },
  { key: 'most', label: 'Most Need wins' },
  { key: 'longest', label: 'Longest since a win' },
  { key: 'losses', label: 'Most lost rolls' },
];

function byBoss(entries: LootEntry[]): { boss: string; difficulty: string | null; entries: LootEntry[] }[] {
  const groups = new Map<string, { boss: string; difficulty: string | null; entries: LootEntry[] }>();
  for (const e of entries) {
    const boss = e.boss ?? 'Boss not confirmed yet';
    const key = `${boss}||${e.difficulty ?? ''}`;
    if (!groups.has(key)) groups.set(key, { boss, difficulty: e.difficulty ?? null, entries: [] });
    groups.get(key)!.entries.push(e);
  }
  return [...groups.values()];
}

function Nights({ loot }: { loot: LootPayload }) {
  const [shown, setShown] = useState(4);
  const nights = useMemo(() => groupLootByNight(annotateWithTrades(loot.records, loot.trades)), [loot]);
  if (nights.length === 0) return <p className="muted">No loot recorded yet.</p>;
  return (
    <>
      {nights.slice(0, shown).map((n) => (
        <div key={n.key} className="card">
          <h3>{dayLabel(n.startTime)} <span className="muted small">{n.entries.length} item{n.entries.length === 1 ? '' : 's'}</span></h3>
          {byBoss([...n.entries].reverse()).map((g) => (
            <div key={`${g.boss}${g.difficulty}`} className="boss">
              <p className="bosshead">{g.boss}{g.difficulty ? <span className="tag">{g.difficulty}</span> : null}</p>
              <ul className="items">
                {g.entries.map((e, i) => (
                  <li key={`${e.time}-${i}`}>
                    <span className="item">{itemLabel(e.itemLink)}</span>
                    <span className="muted small">
                      {shortName(e.winner)}
                      {e.tradedTo ? ` → ${shortName(e.tradedTo)}` : ''} · {clockLabel(e.time)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {nights.length > shown && <button className="chip wide" onClick={() => setShown(shown + 4)}>Show older nights</button>}
    </>
  );
}

function Season({ loot, roster, professions }: { loot: LootPayload; roster: RosterPayload | null; professions: ProfessionsPayload | null }) {
  const [sort, setSort] = useState<Sort>('fewest');
  const [query, setQuery] = useState('');
  const [guests, setGuests] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo<SeasonLootRow[]>(() => {
    const names = roster?.raiders.map((r) => r.name) ?? [];
    const guild = professions ? new Set(professions.members.flatMap((m) => [m.mainName, ...m.characters.map((c) => c.characterName)])) : null;
    return buildSeasonLootReport(annotateWithTrades(loot.records, loot.trades), names, loot.needLosses ?? [], guild);
  }, [loot, roster, professions]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => (guests || !r.isGuest) && (!q || r.name.toLowerCase().includes(q)));
    const cmp: Record<Sort, (a: SeasonLootRow, b: SeasonLootRow) => number> = {
      fewest: (a, b) => a.needWinCount - b.needWinCount || a.name.localeCompare(b.name),
      most: (a, b) => b.needWinCount - a.needWinCount || a.name.localeCompare(b.name),
      longest: (a, b) => (a.lastWonAt ?? 0) - (b.lastWonAt ?? 0) || a.name.localeCompare(b.name),
      losses: (a, b) => b.lossCount - a.lossCount || a.name.localeCompare(b.name),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, sort, query, guests]);

  const guestCount = rows.filter((r) => r.isGuest).length;

  return (
    <>
      <div className="controls">
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input className="search" type="search" placeholder="Find a raider" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a raider" />
      </div>
      {guestCount > 0 && (
        <label className="check">
          <input type="checkbox" checked={guests} onChange={(e) => setGuests(e.target.checked)} /> Show {guestCount} one-night guest{guestCount === 1 ? '' : 's'}
        </label>
      )}
      <ul className="list">
        {shown.map((r) => (
          <li key={r.name} className="row">
            <button className="rowbtn" onClick={() => setOpen(open === r.name ? null : r.name)} aria-expanded={open === r.name}>
              <span className="who">
                <b>{shortName(r.name)}</b>
                <span className="muted small">
                  {r.lastWonAt ? `last win ${dayLabel(r.lastWonAt)}` : 'no wins this tier'}
                  {r.lossCount > 0 ? ` · ${r.lossCount} lost roll${r.lossCount === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <span className="score">
                <span className={`pill ${r.maxNeedWinsInNight >= NEED_WIN_CAP ? 'band-yellow' : 'plain'}`}>{r.maxNeedWinsInNight >= NEED_WIN_CAP ? `at cap ${r.maxNeedWinsInNight}/${NEED_WIN_CAP}` : `${r.maxNeedWinsInNight}/${NEED_WIN_CAP} a night`}</span>
                <span className="num">{r.needWinCount}<span className="unit"> Need win{r.needWinCount === 1 ? '' : 's'}</span></span>
              </span>
            </button>
            {open === r.name && (
              <div className="detail">
                <p className="muted small">{r.needWinCount} Need win{r.needWinCount === 1 ? '' : 's'} kept · {r.totalWon} won in total · the cap is judged per night and difficulty.</p>
                {r.items.length === 0 && <p className="muted">Nothing won yet.</p>}
                <ul className="items">
                  {r.items.slice(0, 12).map((it, i) => (
                    <li key={`${it.time}-${i}`}>
                      <span className="item">{itemLabel(it.itemLink)}</span>
                      <span className="muted small">{it.boss ?? 'boss not confirmed'} · {dayLabel(it.time)}{it.tradedTo ? ` · traded to ${shortName(it.tradedTo)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function LootScreen({ loot, roster, professions }: { loot: Loaded<LootPayload>; roster: Loaded<RosterPayload>; professions: Loaded<ProfessionsPayload> }) {
  const [view, setView] = useState<'nights' | 'season'>('nights');
  return (
    <section>
      <LoadState state={loot} what="loot" />
      <div className="seg" role="tablist" aria-label="Loot view">
        <button role="tab" aria-selected={view === 'nights'} onClick={() => setView('nights')}>Recent nights</button>
        <button role="tab" aria-selected={view === 'season'} onClick={() => setView('season')}>Season</button>
      </div>
      {loot.data && (view === 'nights' ? <Nights loot={loot.data} /> : <Season loot={loot.data} roster={roster.data} professions={professions.data} />)}
    </section>
  );
}
