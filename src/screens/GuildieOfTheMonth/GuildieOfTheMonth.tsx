import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Badge } from '../../design-system/Badge';
import { useGuildieOfTheMonth } from './useGuildieOfTheMonth';
import { useAuth } from '../../shared/useAuth';

function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function CreateDialog({ onClose, onCreate, creating }: { onClose: () => void; onCreate: (introText: string) => void; creating: boolean }) {
  const [introText, setIntroText] = useState('');

  return (
    <Dialog
      title="Open this month's vote"
      eyebrow="Post to Discord"
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!introText.trim() || creating} onClick={() => onCreate(introText.trim())}>
          {creating ? 'Posting…' : 'Post to Discord'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          multiline
          label="Voting announcement"
          placeholder="Write the post exactly as it should appear in Discord -- it'll go out with a Vote button underneath."
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
          autoFocus
        />
      </div>
    </Dialog>
  );
}

export function GuildieOfTheMonth() {
  const g = useGuildieOfTheMonth();
  const auth = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [announceText, setAnnounceText] = useState('');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Guildie of the Month
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          {g.posts.length > 0 && (
            <Select
              label="Month"
              value={g.selected?.id ?? ''}
              onChange={(e) => g.setSelectedId(e.target.value)}
              options={g.posts.map((p) => ({ value: p.id, label: formatMonth(p.month) }))}
              style={{ minWidth: 200 }}
            />
          )}
          <Button iconLeft="plus" onClick={() => setShowCreate(true)}>
            New
          </Button>
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {!g.available ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            Guildie of the Month requires the desktop app.
          </div>
        ) : !g.selected ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No vote open yet -- click "New" to post one to Discord.
          </div>
        ) : (
          <>
            <div className="crd-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
              <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 4 }}>
                {formatMonth(g.selected.month)}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{g.selected.introText}</p>
              {!g.selected.discordMessageId && (
                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--status-danger)' }}>
                  Not posted to Discord -- set a Guildie of the Month channel in Settings, then create a new post.
                </p>
              )}
              {g.selected.closedAt && g.selected.winnerUsername && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Badge tone="success">Winner: {g.selected.winnerUsername}</Badge>
                  {g.selected.winnerTieBrokeAmong && (
                    <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                      Tied with {g.selected.winnerTieBrokeAmong.filter((t) => t.id !== g.selected!.winnerId).map((t) => t.username).join(', ')} -- {g.selected.winnerUsername} was picked at random.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="crd-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-hairline)', fontSize: 'var(--text-body-s)', fontWeight: 600, color: 'var(--text-strong)' }}>
                Tally
              </div>
              {!g.selected.tally || g.selected.tally.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No votes yet.</div>
              ) : (
                g.selected.tally.map((t) => (
                  <div key={t.nomineeId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                    <span style={{ fontSize: 'var(--text-body-m)', color: 'var(--text-strong)' }}>{t.nomineeUsername}</span>
                    <span style={{ fontSize: 'var(--text-body-m)', color: 'var(--text-muted)' }}>{t.count}</span>
                  </div>
                ))
              )}
            </div>

            <div className="crd-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-hairline)', fontSize: 'var(--text-body-s)', fontWeight: 600, color: 'var(--text-strong)' }}>
                Who voted for who
              </div>
              {g.selected.votes.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No votes yet.</div>
              ) : (
                g.selected.votes.map((v) => (
                  <div key={v.voterId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                    <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{v.voterUsername}</span>
                    <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>voted for</span>
                    <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-strong)' }}>{v.nomineeUsername}</span>
                  </div>
                ))
              )}
            </div>

            {!g.selected.closedAt ? (
              <Button onClick={g.closeVoting} disabled={g.closing || g.selected.votes.length === 0} iconLeft="check">
                {g.closing ? 'Closing…' : 'Close voting'}
              </Button>
            ) : !g.selected.winnerAnnounceMessageId ? (
              <div className="crd-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
                  Winner announcement
                </div>
                <Input
                  multiline
                  label="Write it yourself -- it'll post exactly as written"
                  placeholder={`MAKE SOME NOISE FOR ${g.selected.winnerUsername?.toUpperCase()} -- OUR GUILDIE OF THE MONTH!`}
                  value={announceText}
                  onChange={(e) => setAnnounceText(e.target.value)}
                />
                <Button
                  onClick={() => {
                    g.announceWinner(announceText.trim());
                    setAnnounceText('');
                  }}
                  disabled={!announceText.trim() || g.announcing}
                  iconLeft="send"
                >
                  {g.announcing ? 'Posting…' : 'Post to Discord'}
                </Button>
              </div>
            ) : (
              <Badge tone="success">Announced to Discord</Badge>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          creating={g.creating}
          onCreate={(introText) => {
            g.create(auth.displayName, introText);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
