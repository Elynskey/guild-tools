import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_EVENTS, record, recent, resetForTests } from './pipelineLog.cjs';

beforeEach(() => resetForTests());

describe('pipelineLog', () => {
  it('keeps events in order with increasing ids and timestamps', () => {
    record('boss-kill', 'Boss killed: Ula\'tek', { difficultyId: 15 });
    record('chat-win', 'Thundoor won Crown');
    const events = recent();
    expect(events.map((e) => e.kind)).toEqual(['boss-kill', 'chat-win']);
    expect(events[1].id).toBeGreaterThan(events[0].id);
    expect(events[0].meta).toEqual({ difficultyId: 15 });
    expect(events[1].meta).toBeNull();
    expect(events[1].at).toBeGreaterThanOrEqual(events[0].at);
  });

  it('is bounded, dropping the oldest', () => {
    for (let i = 0; i < MAX_EVENTS + 25; i++) record('chat-win', `win ${i}`);
    const events = recent(MAX_EVENTS + 100);
    expect(events).toHaveLength(MAX_EVENTS);
    expect(events[0].text).toBe('win 25');
    expect(events.at(-1).text).toBe(`win ${MAX_EVENTS + 24}`);
  });

  it('recent(n) returns only the newest n', () => {
    for (let i = 0; i < 10; i++) record('chat-win', `win ${i}`);
    expect(recent(3).map((e) => e.text)).toEqual(['win 7', 'win 8', 'win 9']);
  });
});
