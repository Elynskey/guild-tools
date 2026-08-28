import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Tabs } from '../../design-system/Tabs';
import { Badge } from '../../design-system/Badge';
import { useRaidSignups } from './useRaidSignups';
import type { AssignmentTier, RaidRole, TeamType } from '../../electron';

const ROLE_LABEL: Record<RaidRole, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };
const TEAM_LABEL: Record<TeamType, string> = { heroic: 'Heroic Progression', alt: 'Alt Raid' };

function CreateDialog({ onClose, onCreate, creating }: { onClose: () => void; onCreate: (raidName: string, teamType: TeamType, signupText: string) => void; creating: boolean }) {
  const [raidName, setRaidName] = useState('');
  const [teamType, setTeamType] = useState<TeamType>('heroic');
  const [signupText, setSignupText] = useState('');

  return (
    <Dialog
      title="New raid signup"
      eyebrow="Post to Discord"
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!raidName.trim() || creating} onClick={() => onCreate(raidName.trim(), teamType, signupText.trim())}>
          {creating ? 'Posting…' : 'Post to Discord'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Raid name" placeholder="e.g. Liberation of Undermine" value={raidName} onChange={(e) => setRaidName(e.target.value)} autoFocus />
        <Select label="Team" value={teamType} onChange={(e) => setTeamType(e.target.value as TeamType)} options={[{ value: 'heroic', label: 'Heroic Progression' }, { value: 'alt', label: 'Alt Raid' }]} />
        <Input multiline label="Signup announcement" placeholder="What raiders should know before signing up" value={signupText} onChange={(e) => setSignupText(e.target.value)} />
      </div>
    </Dialog>
  );
}

export function RaidSignups() {
  const rs = useRaidSignups();
  const [role, setRole] = useState<RaidRole>('tank');
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Raid Signups
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          {rs.posts.length > 0 && (
            <Select
              label="Signup post"
              value={rs.selected?.id ?? ''}
              onChange={(e) => rs.setSelectedId(e.target.value)}
              options={rs.posts.map((p) => ({ value: p.id, label: `${p.raidName} — ${TEAM_LABEL[p.teamType]}` }))}
              style={{ minWidth: 240 }}
            />
          )}
          <Button iconLeft="plus" onClick={() => setShowCreate(true)}>
            New
          </Button>
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {!rs.available ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            Raid signups require the desktop app.
          </div>
        ) : !rs.selected ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No signup posts yet -- click "New" to post one to Discord.
          </div>
        ) : (
          <>
            <div className="crd-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
              <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 4 }}>
                {TEAM_LABEL[rs.selected.teamType]}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>{rs.selected.raidName}</div>
              {rs.selected.signupText && <p style={{ margin: '0 0 8px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{rs.selected.signupText}</p>}
              {!rs.selected.discordMessageId && (
                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--status-danger)' }}>
                  Not posted to Discord -- set a raid-signups channel in Settings, then create a new post.
                </p>
              )}
              {rs.selected.finalizedAt && <Badge tone="success">Roster posted {new Date(rs.selected.finalizedAt).toLocaleString()}</Badge>}
            </div>

            <Tabs
              tabs={rs.roles.map((r) => ({ value: r, label: ROLE_LABEL[r], count: rs.selected!.signups.filter((s) => s.role === r).length }))}
              value={role}
              onChange={(v) => setRole(v as RaidRole)}
            />

            <div className="crd-card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              {rs.selected.signups.filter((s) => s.role === role).length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>No {ROLE_LABEL[role].toLowerCase()} signups yet.</div>
              ) : (
                rs.selected.signups
                  .filter((s) => s.role === role)
                  .map((s) => {
                    const raider = rs.matchRoster(s.characterName);
                    const utility = rs.utilityFor(rs.selected!, role, s.characterName);
                    const assignment = rs.selected!.assignments[role].find((a) => a.discordUserId === s.discordUserId);
                    return (
                      <div key={s.discordUserId} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr 200px', gap: 14, padding: '12px 20px', borderTop: '1px solid var(--border-hairline)', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-body-m)', fontWeight: 600, color: 'var(--text-strong)' }}>{s.characterName}</div>
                          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>@{s.discordUsername}</div>
                        </div>
                        <div style={{ fontSize: 'var(--text-body-s)', color: raider ? 'var(--text-body)' : 'var(--text-faint)' }}>
                          {raider ? `${raider.perf}% perf` : 'Not on roster'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {raider && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{raider.class}</span>}
                          {utility.map((tag) => (
                            <Badge key={tag} tone="gold">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {(['primary', 'backup'] as AssignmentTier[]).map((tier) => (
                            <Button
                              key={tier}
                              variant={assignment?.tier === tier ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => rs.setAssignment(role, s.discordUserId, assignment?.tier === tier ? null : tier)}
                            >
                              {tier === 'primary' ? 'Primary' : 'Backup'}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <Button onClick={rs.finalize} disabled={rs.finalizing} iconLeft="send">
                {rs.finalizing ? 'Posting…' : 'Post final roster to Discord'}
              </Button>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          creating={rs.creating}
          onCreate={(raidName, teamType, signupText) => {
            rs.create(raidName, teamType, signupText);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
