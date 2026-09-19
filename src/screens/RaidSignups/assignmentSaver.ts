/**
 * Saves a raid signup's primary/backup assignments without losing clicks.
 *
 * The screen used to build each new assignment list from whatever was on screen and then
 * replace the on-screen copy with every save's server response. So a response arriving
 * after the officer's NEXT click wiped that click off the screen, and the click after that
 * built on the wiped version -- one assignment silently lost, and the final roster posted
 * to Discord one raider short (reproduced 2026-09-19 with clicks 350ms apart, well within a
 * network round trip). Parallel saves could also reach the server out of order.
 *
 * So instead:
 *   - every edit builds on the LATEST INTENDED state (not the possibly-stale on-screen one),
 *   - saves run strictly one at a time, each sending the newest intent at the moment it runs
 *     (identical consecutive sends are skipped),
 *   - a server response is only applied to the screen when nothing newer is still waiting,
 *   - and flush() lets "Post final roster" wait for every save to land first.
 */
export interface AssignmentSaverDeps<A, P> {
  send: (postId: string, assignments: A) => Promise<P | null>;
  /** Called with the server's copy only when no newer edit is queued behind it. */
  onSaved: (updated: P) => void;
  onError: (err: Error) => void;
  onBusy: (busy: boolean) => void;
}

export function createAssignmentSaver<A, P>(deps: AssignmentSaverDeps<A, P>) {
  const intended = new Map<string, A>();
  const lastSent = new Map<string, string>();
  let pending = 0;
  let failed = false;
  let chain: Promise<void> = Promise.resolve();

  /** Applies `mutate` to the latest intended assignments (falling back to `serverValue` the first time a post is touched), queues a save, and returns the new intended value for an immediate optimistic render. */
  function edit(postId: string, serverValue: A, mutate: (current: A) => A): A {
    const next = mutate(intended.get(postId) ?? serverValue);
    intended.set(postId, next);
    pending += 1;
    deps.onBusy(true);

    chain = chain.then(async () => {
      try {
        const latest = intended.get(postId) as A;
        const key = JSON.stringify(latest);
        if (lastSent.get(postId) !== key) {
          lastSent.set(postId, key);
          const updated = await deps.send(postId, latest);
          failed = false;
          if (updated && pending === 1) deps.onSaved(updated);
        }
      } catch (err) {
        lastSent.delete(postId); // so the next edit re-sends the full intended state and can heal this
        failed = true;
        deps.onError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        pending -= 1;
        if (pending === 0) deps.onBusy(false);
      }
    });
    return next;
  }

  return {
    edit,
    /** Resolves once every queued save has finished (it never rejects). */
    flush: (): Promise<void> => chain,
    /** True if the most recent save attempt failed -- the server may be missing recent edits. */
    hasFailed: (): boolean => failed,
    isBusy: (): boolean => pending > 0,
    /** Forget local intent and adopt server state again (e.g. after a refresh). Ignored while saves are in flight. */
    reset(): void {
      if (pending > 0) return;
      intended.clear();
      lastSent.clear();
      failed = false;
    },
  };
}
