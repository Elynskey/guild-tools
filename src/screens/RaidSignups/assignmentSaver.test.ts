import { describe, expect, it, vi } from 'vitest';
import { createAssignmentSaver } from './assignmentSaver';

type A = string[]; // stand-in for the assignments object -- the saver treats it opaquely

/** A send() the test controls: each call returns a promise resolved later, in any order. */
function controlledSend() {
  const calls: { postId: string; value: A; resolve: (server: A | null) => void; reject: (e: Error) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const send = vi.fn((postId: string, value: A) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<A | null>((resolve, reject) => {
      calls.push({
        postId,
        value,
        resolve: (s) => {
          inFlight -= 1;
          resolve(s);
        },
        reject: (e) => {
          inFlight -= 1;
          reject(e);
        },
      });
    });
  });
  return { send, calls, maxInFlight: () => maxInFlight };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const c = controlledSend();
  const onSaved = vi.fn();
  const onError = vi.fn();
  const onBusy = vi.fn();
  const saver = createAssignmentSaver<A, A>({ send: c.send, onSaved, onError, onBusy });
  return { ...c, saver, onSaved, onError, onBusy };
}

describe('createAssignmentSaver', () => {
  it('builds each edit on the latest intended state, not a stale server copy (the lost-click bug)', () => {
    const { saver } = setup();
    const server: A = [];
    const a = saver.edit('p1', server, (cur) => [...cur, 'Devkra']);
    // The screen passes a stale `server` again -- e.g. an old response just overwrote it.
    const b = saver.edit('p1', server, (cur) => [...cur, 'Elishaunt']);
    const c = saver.edit('p1', server, (cur) => [...cur, 'Narima']);
    expect(a).toEqual(['Devkra']);
    expect(b).toEqual(['Devkra', 'Elishaunt']);
    expect(c).toEqual(['Devkra', 'Elishaunt', 'Narima']);
  });

  it('sends one save at a time, in order, and the last one carries every edit', async () => {
    const { saver, calls, maxInFlight, send } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    saver.edit('p1', [], (cur) => [...cur, 'B']);
    saver.edit('p1', [], (cur) => [...cur, 'C']);
    await tick();
    expect(send).toHaveBeenCalledTimes(1); // the others wait their turn
    calls[0].resolve(['A', 'B', 'C']);
    await tick();
    // The first queued task already sent the newest state ([A,B,C]); the rest are identical and skipped.
    expect(calls[0].value).toEqual(['A', 'B', 'C']);
    await saver.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(maxInFlight()).toBe(1);
  });

  it('never applies a server response to the screen while a newer edit is still queued', async () => {
    const { saver, calls, onSaved } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    await tick();
    expect(calls).toHaveLength(1);
    saver.edit('p1', [], (cur) => [...cur, 'B']); // clicked while save #1 is in flight
    calls[0].resolve(['A']); // the stale response ([A] only) arrives now
    await tick();
    expect(onSaved).not.toHaveBeenCalled(); // must not wipe B off the screen
    await tick();
    expect(calls).toHaveLength(2);
    expect(calls[1].value).toEqual(['A', 'B']);
    calls[1].resolve(['A', 'B']);
    await saver.flush();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(['A', 'B']);
  });

  it('reports busy from the first edit until the last save lands', async () => {
    const { saver, calls, onBusy } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    saver.edit('p1', [], (cur) => [...cur, 'B']);
    expect(saver.isBusy()).toBe(true);
    await tick();
    calls[0].resolve(['A', 'B']);
    await saver.flush();
    expect(saver.isBusy()).toBe(false);
    expect(onBusy).toHaveBeenNthCalledWith(1, true);
    expect(onBusy).toHaveBeenLastCalledWith(false);
    expect(onBusy.mock.calls.filter(([b]) => b === false)).toHaveLength(1);
  });

  it('flush() waits for saves still in flight (what "Post final roster" now does first)', async () => {
    const { saver, calls } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    let flushed = false;
    void saver.flush().then(() => {
      flushed = true;
    });
    await tick();
    expect(flushed).toBe(false);
    calls[0].resolve(['A']);
    await saver.flush();
    expect(flushed).toBe(true);
  });

  it('a failed save reports the error and the next edit re-sends the full state, healing it', async () => {
    const { saver, calls, onError, onSaved } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    await tick();
    calls[0].reject(new Error('network down'));
    await saver.flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(saver.hasFailed()).toBe(true);

    saver.edit('p1', [], (cur) => [...cur, 'B']);
    await tick();
    expect(calls[1].value).toEqual(['A', 'B']); // includes the edit that failed to save
    calls[1].resolve(['A', 'B']);
    await saver.flush();
    expect(saver.hasFailed()).toBe(false);
    expect(onSaved).toHaveBeenCalledWith(['A', 'B']);
  });

  it('keeps different posts\' edits separate', () => {
    const { saver } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    const other = saver.edit('p2', ['X'], (cur) => [...cur, 'Y']);
    expect(other).toEqual(['X', 'Y']);
  });

  it('reset() adopts the server again when idle, and is ignored while saves are pending', async () => {
    const { saver, calls } = setup();
    saver.edit('p1', [], (cur) => [...cur, 'A']);
    saver.reset(); // ignored: a save is pending
    expect(saver.edit('p1', [], (cur) => [...cur, 'B'])).toEqual(['A', 'B']);
    await tick();
    calls[0].resolve(['A', 'B']);
    await saver.flush();
    saver.reset();
    expect(saver.edit('p1', ['S'], (cur) => [...cur, 'C'])).toEqual(['S', 'C']); // back to the server's copy
  });
});
