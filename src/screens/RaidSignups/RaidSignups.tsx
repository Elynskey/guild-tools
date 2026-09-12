import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Tabs } from '../../design-system/Tabs';
import { Badge } from '../../design-system/Badge';
import { Toast } from '../../design-system/Toast';
import { useRaidSignups } from './useRaidSignups';
import type { AssignmentTier, RaidRole, TeamType } from '../../electron';

const ROLE_LABEL: Record<RaidRole, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };
const TEAM_LABEL: Record<TeamType, string> = { heroic: 'Heroic Progression', alt: 'Alt Raid' };

function CompStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 64 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-title-m)', color: 'var(--text-strong)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-micro)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
    </div>
  );
}

function CreateDialog({
  onClose,
  onCreate,
  creating,
  createError,
}: {
  onClose: () => void;
  onCreate: (raidName: string, teamType: TeamType, signupText: string) => Promise<boolean>;
  creating: boolean;
  createError: string | null;
}) {
  const [raidName, setRaidName] = useState('');
  const [teamType, setTeamType] = useState<TeamType>('heroic');
  const [signupText, setSignupText] = useState('');

  // Stays open on failure (createError renders below) so the officer sees what went
  // wrong and can retry -- only closes once the post actually succeeded.
  const submit = () => {
    void onCreate(raidName.trim(), teamType, signupText.trim()).then((ok) => {
      if (ok) onClose();
    });
  };

  return (
    <Dialog
      title="New raid signup"
      eyebrow="Post to Discord"
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!raidName.trim() || creating} onClick={submit}>
          {creating ? 'Posting…' : 'Post to Discord'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Raid name" placeholder="e.g. Liberation of Undermine" value={raidName} onChange={(e) => setRaidName(e.target.value)} autoFocus />
        <Select label="Team" value={teamType} onChange={(e) => setTeamType(e.target.value as TeamType)} options={[{ value: 'heroic', label: 'Heroic Progression' }, { value: 'alt', label: 'Alt Raid' }]} />
        <Input multiline label="Signup announcement" placeholder="What raiders should know before signing up" value={signupText} onChange={(e) => setSignupText(e.target.value)} />
        {createError && <Toast tone="danger" title="Couldn't post" message={createError} />}
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

            {rs.compSummary && (
              <div className="crd-card" style={{ padding: '18px 24px', marginBottom: 20 }}>
                <div className="crd-eyebrow" style={{ marginBottom: 14 }}>Raid composition — primary assignments</div>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 16 }}>
                  <CompStat label="Tanks" value={rs.compSummary.tanks} />
                  <CompStat label="Healers" value={rs.compSummary.healers} />
                  <CompStat label="Melee" value={rs.compSummary.melee} />
                  <CompStat label="Ranged" value={rs.compSummary.ranged} />
                  {rs.compSummary.ambiguous.length > 0 && (
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', maxWidth: 260, paddingTop: 4 }}>
                      Can't tell melee from ranged (no spec recorded, or picked specs that don't agree): {rs.compSummary.ambiguous.join(', ')}
                    </div>
                  )}
                  {rs.compSummary.tanks + rs.compSummary.healers + rs.compSummary.dps === 0 && (
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', paddingTop: 4 }}>Assign someone Primary in a role below to see this fill in.</div>
                  )}
                </div>
                {rs.buffCoverage && rs.buffCoverage.length > 0 && (
                  <>
                    <div className="crd-eyebrow" style={{ marginBottom: 10 }}>Raid buffs</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {rs.buffCoverage.map(({ tag, covered }) => (
                        <Badge key={tag} tone={covered ? 'success' : 'danger'}>
                          {covered ? '✓' : '✕'} {tag}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

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
                          {rs.classFor(s) && (
                            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                              {rs.specsFor(s)?.length ? `${rs.specsFor(s)!.join('/')} ${rs.classFor(s)}` : rs.classFor(s)}
                            </span>
                          )}
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

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <Button onClick={rs.finalize} disabled={rs.finalizing || !!rs.selected.finalizedAt} iconLeft="send">
                {rs.finalizing ? 'Posting…' : rs.selected.finalizedAt ? 'Roster already posted' : 'Post final roster to Discord'}
              </Button>
              {rs.finalizeError && <Toast tone="danger" title="Couldn't post the final roster" message={rs.finalizeError} />}
              {rs.assignmentError && <Toast tone="danger" title="Couldn't save assignment" message={rs.assignmentError} />}
            </div>
          </>
        )}
      </div>

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} creating={rs.creating} createError={rs.createError} onCreate={rs.create} />}
    </div>
  );
}
