import { LootHistoryHeader } from './LootHistoryHeader';
import { LootLogTable } from './LootLogTable';
import { Button } from '../../design-system/Button';
import { useLootHistory } from './useLootHistory';

function SetupCard({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const needsPath = lh.status === 'not_configured';
  return (
    <div className="crd-card" style={{ padding: '24px 28px', maxWidth: 640 }}>
      <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 8 }}>
        {needsPath ? "Can't find your WoW installation" : 'Addon not installed yet'}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
        {needsPath
          ? "Loot history comes from an in-game addon this app installs for you -- but it couldn't find World of Warcraft in the usual place. Point it at your WoW folder (the one containing \"_retail_\")."
          : 'The Guild Tools Loot addon isn\'t installed yet. Install it, then log in to WoW (or /reload if you\'re already in) -- it starts logging Need-roll wins automatically from then on.'}
      </p>
      {needsPath ? (
        <Button onClick={lh.pickWowFolder} iconLeft="folder">
          Choose WoW folder
        </Button>
      ) : (
        <Button onClick={lh.installAddon} disabled={lh.installing} iconLeft="download">
          {lh.installing ? 'Installing…' : 'Install addon'}
        </Button>
      )}
      {lh.installMessage && <p style={{ marginTop: 12, fontSize: 'var(--text-body-s)', color: 'var(--text-gold)' }}>{lh.installMessage}</p>}
      <p style={{ marginTop: 16, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
        This only ever sees loot from raids played on this PC -- Group Loot results are visible to the whole raid, so it doesn't have to be a specific person's account, just whoever's running Guild Tools here.
      </p>
    </div>
  );
}

export function LootHistory() {
  const lh = useLootHistory();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <LootHistoryHeader nights={lh.nights} selectedNightKey={lh.selectedNightKey} onSelect={lh.setSelectedNightKey} />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {lh.status !== 'ok' ? (
          <SetupCard lh={lh} />
        ) : lh.empty ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No loot logged yet. It'll show up here after your next raid.
          </div>
        ) : (
          <>
            <div className="crd-eyebrow" style={{ marginBottom: 8 }}>
              Need wins this night
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {[...lh.winCounts.entries()].map(([name, count]) => (
                <span
                  key={name}
                  title={count > 2 ? `${count} Need wins -- over the guild's 2-win cap` : `${count} Need win${count === 1 ? '' : 's'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    border: `1px solid ${count > 2 ? 'rgba(168,50,50,.5)' : 'var(--border-hairline)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: count > 2 ? 'rgba(168,50,50,.12)' : 'var(--surface-raised)',
                    fontSize: 'var(--text-body-s)',
                  }}
                >
                  <span style={{ color: 'var(--text-body)' }}>{name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: count > 2 ? 'var(--status-danger)' : 'var(--text-gold)' }}>{count}</span>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by raider…"
                value={lh.query}
                onChange={(e) => lh.setQuery(e.target.value)}
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
              {lh.query && (
                <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                  {lh.visibleEntries.length} match{lh.visibleEntries.length === 1 ? '' : 'es'}
                </div>
              )}
            </div>
            <LootLogTable entries={lh.visibleEntries} />
          </>
        )}
      </div>
    </div>
  );
}
