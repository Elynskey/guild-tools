import { useMemo, useState } from 'react';
import { config } from '../../../src/config';
import { ROLE_SECTIONS, rosterSummary, scoreRoster, sortBestFirst, sortWorstFirst } from '../../../src/scoring/scoring';
import type { Band, Role, ScoredRaider, Window } from '../../../src/scoring/types';
import type { RosterPayload } from '../api';
import type { Loaded } from '../useLoad';
import { timeAgo } from '../format';
import { LoadState } from '../ui';

const BANDS: { key: Band; label: string }[] = [
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'red', label: 'Red' },
  { key: 'ineligible', label: 'Ineligible' },
];

function Detail({ r }: { r: ScoredRaider }) {
  const f = r.feedback;
  return (
    <div className="detail">
      <div className="facts">
        <span>Score <b>{r.score ?? '–'}</b></span>
        <span>Deaths <b>{r.deathsInWindow}</b>/{r.pullsInWindow} pulls</span>
        <span>Gear <b>{Math.round(r.gearCompletion)}%</b></span>
        <span>ilvl <b>{Math.round(r.ilvlBest)}</b></span>
        <span>RIO <b>{Math.round(r.rioBest)}</b></span>
      </div>
      {(r.ilvlFail || r.rioFail) && <p className="warn">Fails a gate: {[r.ilvlFail && 'item level', r.rioFail && 'Raider.IO'].filter(Boolean).join(' and ')}.</p>}
      {r.deathCapped && <p className="warn">{r.deathCapNote}</p>}
      {f.status && <p>{f.status}</p>}
      {f.working && <p><b>Working:</b> {f.working}</p>}
      {f.attention && <p><b>Watch:</b> {f.attention}</p>}
      {f.action && <p><b>Next:</b> {f.action}</p>}
      {r.gearDetail && (r.gearDetail.missingEnchants.length > 0 || r.gearDetail.emptySockets > 0) && (
        <p className="warn">
          {r.gearDetail.missingEnchants.length > 0 && <>Missing enchants: {r.gearDetail.missingEnchants.join(', ')}. </>}
          {r.gearDetail.emptySockets > 0 && <>Empty sockets: {r.gearDetail.emptySockets} of {r.gearDetail.totalSockets}.</>}
        </p>
      )}
    </div>
  );
}

export function RaidersScreen({ roster }: { roster: Loaded<RosterPayload> }) {
  const [win, setWin] = useState<Window>(config.defaultWindow);
  const [role, setRole] = useState<'all' | Role>('all');
  const [band, setBand] = useState<'all' | Band>('all');
  const [query, setQuery] = useState('');
  const [bestFirst, setBestFirst] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const scored = useMemo<ScoredRaider[]>(() => {
    if (!roster.data) return [];
    const raiders = win === 'night' ? roster.data.raiders.filter((r) => r.nightAttended) : roster.data.raiders;
    return scoreRoster(raiders, win, config.gates);
  }, [roster.data, win]);

  const summary = useMemo(() => rosterSummary(scored, win), [scored, win]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scored.filter((r) => (role === 'all' || r.role === role) && (band === 'all' || r.band === band) && (!q || r.name.toLowerCase().includes(q) || r.subline.toLowerCase().includes(q)));
    return [...list].sort(bestFirst ? sortBestFirst : sortWorstFirst);
  }, [scored, role, band, query, bestFirst]);

  return (
    <section>
      <LoadState state={roster} what="the roster" />
      {roster.data && (
        <>
          <p className="muted small">
            {roster.data.raiders.length} raiders · pulled {timeAgo(new Date(roster.data.fetchedAt).getTime())}
            {roster.data.heroicBossesKilled != null && ` · ${roster.data.heroicBossesKilled}/${config.tier.totalBosses} ${config.tier.progressionDifficulty} bosses`}
          </p>

          <div className="seg" role="tablist" aria-label="Time window">
            <button role="tab" aria-selected={win === 'rolled'} onClick={() => setWin('rolled')}>Last 6 weeks</button>
            <button role="tab" aria-selected={win === 'night'} onClick={() => setWin('night')}>Last raid night</button>
          </div>

          <div className="tiles">
            {BANDS.map((b) => (
              <button key={b.key} className={`tile band-${b.key}${band === b.key ? ' on' : ''}`} onClick={() => setBand(band === b.key ? 'all' : b.key)} aria-pressed={band === b.key}>
                <span className="n">{summary.counts[b.key]}</span>
                <span className="l">{b.label}</span>
              </button>
            ))}
          </div>

          <div className="chips">
            <button className={role === 'all' ? 'chip on' : 'chip'} onClick={() => setRole('all')}>All</button>
            {ROLE_SECTIONS.map((s) => (
              <button key={s.key} className={role === s.key ? 'chip on' : 'chip'} onClick={() => setRole(s.key)}>{s.label}</button>
            ))}
            <button className="chip ghost" onClick={() => setBestFirst(!bestFirst)}>{bestFirst ? 'Best first' : 'Needs help first'}</button>
          </div>

          <input className="search" type="search" placeholder="Find a raider" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a raider" />

          {rows.length === 0 && <p className="muted">Nobody matches.</p>}
          <ul className="list">
            {rows.map((r) => (
              <li key={r.name} className={`row band-${r.band}`}>
                <button className="rowbtn" onClick={() => setOpen(open === r.name ? null : r.name)} aria-expanded={open === r.name}>
                  {r.portraitUrl ? <img className="avatar" src={r.portraitUrl} alt="" loading="lazy" width={40} height={40} /> : <span className="avatar blank" aria-hidden="true">{r.name.slice(0, 1)}</span>}
                  <span className="who">
                    <b>{r.name}</b>
                    <span className="muted small">{r.subline}</span>
                  </span>
                  <span className="score">
                    <span className={`pill band-${r.band}`}>{r.bandLabel}</span>
                    <span className="num">{r.score ?? '–'}</span>
                  </span>
                </button>
                {open === r.name && <Detail r={r} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
