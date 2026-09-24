import { useState } from 'react';
import { LootHistoryHeader } from './LootHistoryHeader';
import { LootLogTable } from './LootLogTable';
import { LootRecordDialog } from './LootRecordDialog';
import { PostToDiscordDialog } from './PostToDiscordDialog';
import { DeleteNightDialog } from './DeleteNightDialog';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Link } from 'react-router-dom';
import { HelpTooltip } from '../../design-system/HelpTooltip';
import { useLootHistory } from './useLootHistory';
import { NEED_WIN_CAP, type LootEntry } from '../../raid/lootLogic';

function timeAgo(ms: number | null): string {
  if (ms == null) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

// The obvious, glanceable answer to "is tonight's loot actually being captured right
// now" -- added after chat-tail silently captured nothing for a full raid night with
// zero error anywhere (a parser mismatch against WoW's real on-disk log format -- see
// lootChatTail.cjs). Previously the only signals were an in-game popup and chat lines
// that scroll away; this makes the same fact checkable from the app itself, updating
// every 10s to match main.cjs's own poll cadence.
// "Am I logging" only answers half the real question during a raid -- Group Loot
// broadcasts to everyone, so capture works as long as AT LEAST ONE officer's app has
// chat logging active, not necessarily this one. Reads the proxy-aggregated heartbeat
// list (lootCaptureHeartbeats.cjs, one entry per officer whose app checked in within
// the last ~30s) so that's answerable from any officer's screen, not just "for me."
function RaidCoverageRow({ heartbeats }: { heartbeats: { officerName: string; chatLogActive: boolean; lastSeenAt: number }[] }) {
  if (heartbeats.length === 0) {
    return (
      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
        No other officers' Guild Tools apps have reported in yet -- can't confirm raid-wide coverage from here.
      </div>
    );
  }

  const activeOfficers = heartbeats.filter((h) => h.chatLogActive);
  const covered = activeOfficers.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Badge tone={covered ? 'gold' : 'warning'} dot>
        {covered ? 'Raid covered' : 'No one logging'}
      </Badge>
      <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
        {covered
          ? `${activeOfficers.length} of ${heartbeats.length} officer app${heartbeats.length === 1 ? '' : 's'} reporting in has chat logging active (${activeOfficers.map((h) => h.officerName).join(', ')}).`
          : `${heartbeats.length} officer app${heartbeats.length === 1 ? '' : 's'} reporting in, but none has chat logging confirmed on -- live capture won't work for anyone until someone turns chat logging on (the addon does it automatically at login, or type /chatlog). The addon has to be version 1.7 or newer for the game to report its state; before that an officer whose file is just behind can look off here.`}
      </span>
    </div>
  );
}

const CHARACTER_SOURCE_LABEL = { manual: 'set by you', addon: 'from the addon', wtf: 'from your WoW folder' } as const;

// Which character this PC plays -- needed because WoW's chat log calls your OWN wins
// "You". Read from the client instead of typed in: what the addon recorded at login,
// else the last character the client saved (see lootLog.cjs). Manual entry only exists
// as an override for when that's wrong.
function CharacterRow({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const cfg = lh.wowPath;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const detected = !!cfg?.characterName;
  const showInput = editing || !detected;

  const save = () => {
    lh.setCharacterName(draft.trim());
    setEditing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
        {detected ? (
          <>
            <span>
              Playing as <strong style={{ color: 'var(--text-strong)' }}>{cfg!.characterName}</strong>
              {cfg!.characterSource && <span style={{ color: 'var(--text-faint)' }}> ({CHARACTER_SOURCE_LABEL[cfg!.characterSource]})</span>}
            </span>
            {cfg!.characterSource === 'manual' ? (
              <Button variant="ghost" size="sm" onClick={() => lh.setCharacterName('')} disabled={lh.savingCharacterName}>
                Use detected instead
              </Button>
            ) : (
              !editing && (
                <Button variant="ghost" size="sm" onClick={() => { setDraft(''); setEditing(true); }}>
                  Not the character you're raiding on?
                </Button>
              )
            )}
          </>
        ) : (
          <span>Couldn't tell which character you play from your WoW folder -- type it here:</span>
        )}
        {showInput && (
          <>
            <input
              aria-label="Your character name"
              type="text"
              placeholder="e.g. Elishaunt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) save(); }}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-raised)',
                color: 'var(--text-body)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-body-s)',
                minWidth: 160,
              }}
            />
            <Button variant="secondary" size="sm" onClick={save} disabled={!draft.trim() || lh.savingCharacterName}>
              {lh.savingCharacterName ? 'Saving…' : 'Save'}
            </Button>
            {detected && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </>
        )}
      </div>
      {detected && cfg!.characterSource !== 'manual' && (
        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', lineHeight: 1.5 }}>
          Read from the last time WoW saved (a logout or /reload). If you've switched characters this session, /reload in game to update it -- your own wins still get matched to the right
          character once the addon syncs.
        </div>
      )}
    </div>
  );
}

// The installed addon is older than the copy this build of Guild Tools carries. Compared on
// disk, so it can't see what the running game has loaded -- hence "then /reload".
function AddonUpdateBanner({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const v = lh.addonVersion;
  if (!v || v.status !== 'outdated') return null;
  return (
    <div className="crd-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: 'rgba(192,144,47,.5)' }}>
      <Badge tone="warning" dot>
        Addon out of date
      </Badge>
      <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', flex: 1, minWidth: 260 }}>
        Your Guild Tools Loot addon is v{v.installed}; this version of Guild Tools includes v{v.bundled}. Update it, then type /reload in game so WoW loads the new one.
      </span>
      <Button size="sm" onClick={lh.installAddon} disabled={lh.installing} iconLeft="download">
        {lh.installing ? 'Updating…' : 'Update addon now'}
      </Button>
    </div>
  );
}

// One shared setting for every officer (settings.autoPostLoot on the proxy) -- see
// lootAutoPost.cjs for exactly what gets posted and what never does.
const DIFFICULTY_NAME: Record<number, string> = { 14: 'Normal', 15: 'Heroic' };

// This PC's half of live posting: is a combat log being written, and what boss kill was last
// seen in it? (The combat log is how Guild Tools learns which boss a win came from.)
function combatLogLine(lh: ReturnType<typeof useLootHistory>): { text: string; ok: boolean } | null {
  const c = lh.chatTailStatus?.combatLog;
  if (!c) return null;
  if (!c.exists || !c.active) {
    return {
      ok: false,
      text: `${c.exists ? "Combat log on this PC isn't being written right now" : 'No combat log found on this PC'} -- turn on combat logging (the Warcraft Logs / Archon logger does this for raids) so wins can post live. Until then they post after the addon syncs (a /reload).`,
    };
  }
  const k = c.lastKill;
  return {
    ok: true,
    text: k
      ? `Combat log on this PC is live -- last boss kill seen: ${k.boss}${DIFFICULTY_NAME[k.difficultyId] ? ` (${DIFFICULTY_NAME[k.difficultyId]})` : ''}, ${timeAgo(k.endedAt)}.`
      : 'Combat log on this PC is live -- no boss kill seen yet this session.',
  };
}

/** Read-only: whether auto-post is on (it is changed in Settings) and this PC's half of live posting. */
function AutoPostRow({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  if (!lh.available || !lh.autoPostReady) return null;
  const on = lh.autoPostLoot;
  const combat = combatLogLine(lh);
  return (
    <div className="crd-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--text-body-s)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Auto-post new wins to Discord
          <HelpTooltip text="Posts each Need win to the loot channel on its own, one message per boss headed by the difficulty. Live (within about 10 seconds) when an officer's PC has chat logging and combat logging on; otherwise once the addon syncs. Never posts wins it can't tie to this tier's boss and a Normal/Heroic kill, wins older than 6 hours, or the same win twice." />
        </span>
        <Badge tone={on ? 'gold' : 'neutral'}>{on ? 'On for all officers' : 'Off'}</Badge>
        <Link to="/settings" style={{ fontSize: 'var(--text-micro)' }}>
          Change in Settings
        </Link>
      </div>
      {combat && <div style={{ fontSize: 'var(--text-micro)', color: combat.ok ? 'var(--text-faint)' : 'var(--status-warning)', lineHeight: 1.5 }}>{combat.text}</div>}
      {on && !lh.autoPostChannelSet && (
        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--status-warning)' }}>No loot channel is set yet -- add one in Settings or nothing will be posted.</div>
      )}
    </div>
  );
}

/** Checks chat logging for this PC and every other officer at once. WoW writes the log file only when you log out (a /reload does not write it), so a quiet file during play is normal: this tells a real write (verified) from "on, the file is behind" (buffered) from "not on" (failed). */
function VerifyRow({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const v = lh.verify;
  const failedNames = [...(v.self === 'failed' ? ['this PC'] : []), ...v.others.filter((o) => o.status === 'failed').map((o) => o.name.split('#')[0])];
  const bufferedNames = [...(v.self === 'buffered' ? ['this PC'] : []), ...v.others.filter((o) => o.status === 'buffered').map((o) => o.name.split('#')[0])];
  const chip = (label: string, status: 'verified' | 'waiting' | 'buffered' | 'failed') => (
    <span
      key={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 9px',
        borderRadius: 999,
        border: `1px solid ${status === 'verified' ? 'rgba(95,158,74,.6)' : status === 'failed' ? 'rgba(192,144,47,.6)' : status === 'buffered' ? 'rgba(201,169,97,.5)' : 'var(--border-hairline)'}`,
        fontSize: 'var(--text-micro)',
        color: status === 'verified' ? 'var(--status-success)' : status === 'failed' ? 'var(--status-warning)' : status === 'buffered' ? 'var(--text-gold)' : 'var(--text-muted)',
      }}
    >
      {status === 'verified' ? '✓' : status === 'failed' ? '✕' : status === 'buffered' ? '●' : '…'} {label}
      {status === 'buffered' ? ' (on, file behind)' : ''}
    </span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => void lh.startVerify()} disabled={v.phase === 'waiting'} iconLeft="check">
          {v.phase === 'waiting' ? `Watching… ${v.secondsLeft}s` : 'Verify chat logging'}
        </Button>
        <HelpTooltip text="WoW keeps chat lines in memory and writes the chat log file only when you log out (a /reload does not write it), so a quiet file during play is normal and does NOT mean logging is off. Say ONE line in raid or party chat while this watches: a check mark means that officer's file really got written just now (usually right after a reload). A gold dot means their game says logging is ON and the file will catch up when you next log out. A cross means logging is not on, or can't be confirmed (the addon must be version 1.7+ for the game to report its state). Officers not in your raid group show the same way." />
        {v.phase === 'waiting' && <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>Say one line in raid or party chat now, in game.</span>}
        {v.phase === 'done' && failedNames.length === 0 && bufferedNames.length === 0 && <Badge tone="success">Verified: everyone is writing</Badge>}
        {v.phase === 'done' && failedNames.length === 0 && bufferedNames.length > 0 && <Badge tone="gold">Logging is on; files catch up at a reload</Badge>}
        {v.phase === 'done' && failedNames.length > 0 && <Badge tone="warning">{failedNames.length} not confirmed on</Badge>}
      </div>
      {v.phase !== 'idle' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip('This PC', v.self)}
          {v.others.map((o) => chip(o.name.split('#')[0], o.status))}
        </div>
      )}
      {v.phase === 'done' && bufferedNames.length > 0 && (
        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Chat logging is ON for <b>{bufferedNames.join(', ')}</b>, but WoW hasn't written the file yet. It only does that when you log out (a /reload doesn't), so live loot from the chat log shows up then; the addon's own capture is not affected.
        </div>
      )}
      {v.phase === 'done' && failedNames.length > 0 && (
        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--status-warning)', lineHeight: 1.5 }}>
          Chat logging is not confirmed on for: <b>{failedNames.join(', ')}</b>. In game, open <b>/gtloot</b> and press <b>Restart chat logging</b> (or type <b>/chatlog</b>), and make sure the addon is version 1.7 or newer so the game can report its state. Officers who aren't in this raid group can show here too.
        </div>
      )}
    </div>
  );
}

function LiveCaptureCard({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const chatLog = lh.chatTailStatus?.chatLog;
  const nameSet = !!lh.wowPath?.characterName;

  let statusTone: 'success' | 'warning' | 'neutral' = 'neutral';
  let statusText = 'Checking…';
  let statusLabel: string | null = null;
  const state = chatLog ? (chatLog.state ?? (chatLog.active ? 'writing' : 'unknown')) : null;
  if (chatLog) {
    if (!chatLog.exists) {
      statusTone = 'warning';
      statusText = "Can't find your WoW chat log yet -- type /chatlog in game (it works right away, no logout needed). The addon also turns it on for you at login.";
    } else if (state === 'off') {
      statusTone = 'warning';
      statusLabel = 'Chat logging is off';
      statusText = `The game reported chat logging OFF (${timeAgo(chatLog.gameReading?.at ?? null)}). Type /chatlog in game -- it works right away, and the addon also turns it on at login.`;
    } else if (state === 'on-buffered') {
      statusTone = 'success';
      statusLabel = 'Logging is on';
      statusText = `Chat logging is ON (the game said so ${timeAgo(chatLog.gameReading?.at ?? null)}). WoW writes the chat log file only when you log out (a /reload does not write it), so live loot from it updates then -- its last write was ${timeAgo(chatLog.lastWriteAt)}.`;
    } else if (state === 'unknown') {
      statusTone = 'neutral';
      statusLabel = "Can't tell yet";
      statusText = `The chat log file was last written ${timeAgo(chatLog.lastWriteAt)}, which is normal: WoW writes it only when you log out. The game hasn't reported whether logging is on yet -- that needs the addon at version 1.7 or newer and one reload.`;
    } else if (!nameSet) {
      statusTone = 'warning';
      statusText = "Watching your chat log, but I can't tell which character you play yet -- set it below so your own wins are captured live.";
    } else {
      statusTone = 'success';
      statusText = `Watching your chat log for live loot -- last checked ${timeAgo(lh.chatTailStatus?.lastPollAt ?? null)}.`;
    }
  }

  return (
    <div
      className="crd-card"
      style={{
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderColor: statusTone === 'warning' ? 'rgba(192,144,47,.5)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Badge tone={statusTone === 'success' ? 'gold' : statusTone === 'warning' ? 'warning' : 'neutral'} dot>
          {statusLabel ?? (statusTone === 'success' ? 'Live for this raid' : statusTone === 'warning' ? 'Needs attention' : 'Checking')}
        </Badge>
        <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{statusText}</span>
        {(lh.chatTailStatus?.capturedThisSession ?? 0) > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {lh.chatTailStatus!.capturedThisSession} captured live this session -- last {timeAgo(lh.chatTailStatus!.lastCaptureAt)}
          </span>
        )}
      </div>
      <VerifyRow lh={lh} />
      <RaidCoverageRow heartbeats={lh.captureHeartbeats} />
      <CharacterRow lh={lh} />
    </div>
  );
}

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
  const [editing, setEditing] = useState<LootEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);
  const [deletingNightOpen, setDeletingNightOpen] = useState(false);

  const selectedNight = lh.nights.find((n) => n.key === lh.selectedNightKey) ?? null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <LootHistoryHeader
        nights={lh.nights}
        selectedNightKey={lh.selectedNightKey}
        onSelect={lh.setSelectedNightKey}
        onRefresh={lh.refresh}
        refreshing={lh.refreshing}
        onDeleteNight={lh.available && selectedNight ? () => setDeletingNightOpen(true) : undefined}
      />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {lh.status === 'ok' && <AddonUpdateBanner lh={lh} />}
        {lh.status === 'ok' && <LiveCaptureCard lh={lh} />}
        {lh.status === 'ok' && <AutoPostRow lh={lh} />}
        {lh.status === 'ok' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
              padding: '12px 16px',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-raised)',
              fontSize: 'var(--text-body-s)',
              color: 'var(--text-muted)',
            }}
          >
            <div className="crd-eyebrow">In-game commands</div>
            <div>
              <code>/gtloot</code> -- opens a small window with buttons: stop or start logging for this run (old content, alts, off-progression), scan Loot History for wins the addon missed live, and restart chat logging if it reads OFF. It also shows whether logging and chat logging are on. A quiet chat log file is normal: WoW writes it only when you log out.
            </div>
            <div>
              <code>/chatlog</code> -- turns on live updates to this app. Works right away (no logout), but it switches itself off every time you log out to the character screen, so the addon now turns it back on at login and when you press Start logging. The <code>/gtloot</code> window re-checks it each time you open it.
            </div>
          </div>
        )}
        {lh.status === 'ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
            <Button variant="ghost" size="sm" onClick={lh.installAddon} disabled={lh.installing} iconLeft="download">
              {lh.installing ? 'Updating…' : 'Update addon'}
            </Button>
            {lh.installMessage
              ? lh.installMessage
              : lh.addonVersion?.status === 'current'
                ? `Addon v${lh.addonVersion.installed} is up to date with this version of Guild Tools.`
                : 'Re-copies the addon bundled in this build of Guild Tools -- run this after updating the app to pick up addon fixes.'}
          </div>
        )}
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
              {[...lh.winCounts.entries()].map(([name, tally]) => {
                const over = tally.capCount > NEED_WIN_CAP;
                const parts = tally.byDifficulty.map((d) => `${d.count} ${d.difficulty ?? 'unknown difficulty'}`);
                const split = tally.byDifficulty.length > 1;
                return (
                  <span
                    key={name}
                    title={
                      over
                        ? `${tally.total} Need win${tally.total === 1 ? '' : 's'} (${parts.join(', ')}) -- over the guild's ${NEED_WIN_CAP}-win cap at one difficulty`
                        : split
                          ? `${tally.total} Need wins (${parts.join(', ')}) -- within the ${NEED_WIN_CAP}-win cap, which is counted per difficulty`
                          : `${tally.total} Need win${tally.total === 1 ? '' : 's'}${parts.length ? ` (${parts.join(', ')})` : ''}`
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      border: `1px solid ${over ? 'rgba(168,50,50,.5)' : 'var(--border-hairline)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: over ? 'rgba(168,50,50,.12)' : 'var(--surface-raised)',
                      fontSize: 'var(--text-body-s)',
                    }}
                  >
                    <span style={{ color: 'var(--text-body)' }}>{name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: over ? 'var(--status-danger)' : 'var(--text-gold)' }}>{tally.total}</span>
                    {split && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{parts.join(' · ')}</span>}
                  </span>
                );
              })}
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
              <div style={{ flex: 1 }} />
              {lh.available && (
                <Button variant="secondary" size="sm" iconLeft="send" onClick={() => setPostingOpen(true)}>
                  Post to Discord
                </Button>
              )}
              {lh.available && (
                <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setAdding(true)}>
                  Add entry
                </Button>
              )}
            </div>
            <LootLogTable entries={lh.visibleEntries} itemIcons={lh.itemIcons} itemIdByName={lh.itemIdByName} onEdit={lh.available ? setEditing : undefined} />
          </>
        )}
      </div>

      {(editing || adding) && (
        <LootRecordDialog
          entry={editing ?? undefined}
          saving={lh.saving}
          bossLootTable={lh.bossLootTable}
          classByName={lh.classByName}
          itemIcons={lh.itemIcons}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          saveError={lh.saveError}
          onSave={async (fields, keepOpen) => {
            const ok = editing?.id ? await lh.updateRecord(editing.id, fields) : await lh.addRecord(fields);
            if (ok && !keepOpen) {
              setEditing(null);
              setAdding(false);
            }
            return ok;
          }}
          onDelete={
            editing?.id
              ? () => {
                  lh.removeRecord(editing.id!);
                  setEditing(null);
                }
              : editing?.tradeId
                ? () => {
                    lh.removeTrade(editing.tradeId!);
                    setEditing(null);
                  }
                : undefined
          }
        />
      )}

      {deletingNightOpen && selectedNight && (
        <DeleteNightDialog
          entryCount={selectedNight.entries.length}
          nightLabel={new Date(selectedNight.startTime * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          deleting={lh.deletingNight}
          error={lh.deleteNightError}
          onClose={() => setDeletingNightOpen(false)}
          onConfirm={() => {
            lh.deleteNight().then((ok) => {
              if (ok) setDeletingNightOpen(false);
            });
          }}
        />
      )}

      {postingOpen && (
        <PostToDiscordDialog
          messages={lh.nightMessagesForDiscord}
          posting={lh.posting}
          error={lh.postError}
          unverifiedCount={lh.unverifiedCount}
          onRefresh={lh.refresh}
          onClose={() => setPostingOpen(false)}
          onConfirm={() => {
            lh.postNightToDiscord().then((ok) => {
              if (ok) setPostingOpen(false);
            });
          }}
        />
      )}
    </div>
  );
}
