import { useMemo } from 'react';
import type { HeartbeatPayload, LootPayload } from '../api';
import type { Loaded } from '../useLoad';
import { buildCaptureView } from '../captureStatus';
import { clockLabel, dayLabel, timeAgo } from '../format';
import { LoadState } from '../ui';

const seenLabel = (s: number) => (s < 45 ? 'now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} hr ago`);

export function CaptureScreen({ loot, beats }: { loot: Loaded<LootPayload>; beats: Loaded<HeartbeatPayload> }) {
  const view = useMemo(() => {
    if (!loot.data) return null;
    return buildCaptureView(loot.data.records, beats.data?.heartbeats ?? [], beats.data?.serverNow ?? Date.now());
  }, [loot.data, beats.data]);

  return (
    <section>
      <LoadState state={loot} what="loot capture" />
      {view && (
        <>
          <div className={`banner tone-${view.headline.tone}`} role="status">{view.headline.text}</div>

          <div className="card">
            <h3>Officers' apps <span className="muted small">{view.officers.length} open</span></h3>
            {view.officers.length === 0 ? (
              <p className="muted">None are reporting in right now.</p>
            ) : (
              <ul className="items">
                {view.officers.map((o) => (
                  <li key={o.name}>
                    <span className="item">{o.name}</span>
                    <span className={o.loggingOn ? 'ok small' : 'muted small'}>{o.loggingOn ? 'chat logging on' : 'logging not confirmed'} · seen {seenLabel(o.seenSecondsAgo)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">WoW only writes its chat log file when a player logs out, so "on" means that officer's game or app says it is on, not that lines are arriving live.</p>
          </div>

          <div className="card">
            <h3>Loot store</h3>
            <dl className="stats">
              <div><dt>Newest win</dt><dd>{view.newestWinAt ? `${dayLabel(view.newestWinAt)}, ${clockLabel(view.newestWinAt)} (${timeAgo(view.newestWinAt * 1000)})` : 'none yet'}</dd></div>
              <div><dt>Wins in the last 6 hours</dt><dd>{view.recentWins}</dd></div>
              <div><dt>Waiting for an addon to confirm</dt><dd className={view.waitingOnAddon > 0 ? 'warn' : ''}>{view.waitingOnAddon}</dd></div>
              <div><dt>Posted to Discord</dt><dd>{view.postable === 0 ? 'nothing to post' : `${view.posted} of ${view.postable}`}</dd></div>
              <div><dt>Overdue to post</dt><dd className={view.overdue > 0 ? 'warn' : ''}>{view.overdue}</dd></div>
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
