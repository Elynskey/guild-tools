import { useEffect, useState } from 'react';
import { LootHistoryHeader } from './LootHistoryHeader';
import { LootLogTable } from './LootLogTable';
import { LootRecordDialog } from './LootRecordDialog';
import { PostToDiscordDialog } from './PostToDiscordDialog';
import { DeleteNightDialog } from './DeleteNightDialog';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { useLootHistory } from './useLootHistory';
import type { LootEntry } from '../../raid/lootLogic';

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
          : `${heartbeats.length} officer app${heartbeats.length === 1 ? '' : 's'} reporting in, but none have chat logging active -- live capture won't work for anyone until someone turns chat logging on (the addon does it automatically at login, or type /chatlog).`}
      </span>
    </div>
  );
}

function LiveCaptureCard({ lh }: { lh: ReturnType<typeof useLootHistory> }) {
  const [nameDraft, setNameDraft] = useState(lh.wowPath?.characterName ?? '');
  useEffect(() => {
    setNameDraft(lh.wowPath?.characterName ?? '');
  }, [lh.wowPath?.characterName]);

  const chatLog = lh.chatTailStatus?.chatLog;
  const nameSet = !!lh.wowPath?.characterName;

  let statusTone: 'success' | 'warning' | 'neutral' = 'neutral';
  let statusText = 'Checking…';
  if (chatLog) {
    if (!chatLog.exists) {
      statusTone = 'warning';
      statusText = "Can't find your WoW chat log yet -- type /chatlog in game (it works right away, no logout needed). The addon also turns it on for you at login.";
    } else if (!chatLog.active) {
      statusTone = 'warning';
      statusText = 'Chat log found, but nothing written to it recently -- is WoW open and running on this PC?';
    } else if (!nameSet) {
      statusTone = 'warning';
      statusText = 'Watching your chat log, but your own wins need a character name below to be captured live.';
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
          {statusTone === 'success' ? 'Live for this raid' : statusTone === 'warning' ? 'Needs attention' : 'Checking'}
        </Badge>
        <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{statusText}</span>
        {(lh.chatTailStatus?.capturedThisSession ?? 0) > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {lh.chatTailStatus!.capturedThisSession} captured live this session -- last {timeAgo(lh.chatTailStatus!.lastCaptureAt)}
          </span>
        )}
      </div>
      <RaidCoverageRow heartbeats={lh.captureHeartbeats} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }} htmlFor="gtloot-character-name">
          Your character name (for your own live wins):
        </label>
        <input
          id="gtloot-character-name"
          type="text"
          placeholder="e.g. Vitaezra"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft.trim() !== (lh.wowPath?.characterName ?? '')) lh.setCharacterName(nameDraft.trim());
          }}
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
        {lh.savingCharacterName && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>Saving…</span>}
      </div>
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
        {lh.status === 'ok' && <LiveCaptureCard lh={lh} />}
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
              <code>/gtloot</code> -- check status in-game (pops up a dialog: logging on/off, chat logging on/off)
            </div>
            <div>
              <code>/gtloot on</code> / <code>/gtloot off</code> -- toggle logging for this run (old content, alts, off-progression)
            </div>
            <div>
              <code>/gtloot scan</code> -- pull in any wins Loot History caught but the addon missed live
            </div>
            <div>
              <code>/chatlog</code> -- turns on live updates to this app. Works right away (no logout), but it switches itself off every time you log out to the character screen, so the addon now turns it back on at login and on <code>/gtloot on</code>. The Refresh button on the <code>/gtloot</code> popup re-checks it.
            </div>
          </div>
        )}
        {lh.status === 'ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
            <Button variant="ghost" size="sm" onClick={lh.installAddon} disabled={lh.installing} iconLeft="download">
              {lh.installing ? 'Updating…' : 'Update addon'}
            </Button>
            {lh.installMessage ? lh.installMessage : 'Re-copies the addon bundled in this build of Guild Tools -- run this after updating the app to pick up addon fixes.'}
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
