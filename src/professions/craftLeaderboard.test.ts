import { describe, expect, it } from 'vitest';
import { buildCraftLeaderboard } from './craftLeaderboard';
import type { CraftRequest } from './types';

function request(overrides: Partial<CraftRequest>): CraftRequest {
  return {
    id: crypto.randomUUID(),
    requester: 'Someone',
    profession: 'Blacksmithing',
    description: 'A sword',
    createdAt: new Date().toISOString(),
    fulfilled: false,
    fulfilledBy: null,
    discordMessageId: null,
    ...overrides,
  };
}

describe('buildCraftLeaderboard', () => {
  it('counts fulfilled requests per crafter, sorted most to fewest', () => {
    const requests = [
      request({ fulfilled: true, fulfilledBy: 'Anvil' }),
      request({ fulfilled: true, fulfilledBy: 'Anvil' }),
      request({ fulfilled: true, fulfilledBy: 'Stitch' }),
    ];
    expect(buildCraftLeaderboard(requests)).toEqual([
      { crafter: 'Anvil', count: 2 },
      { crafter: 'Stitch', count: 1 },
    ]);
  });

  it('ignores unfulfilled requests and requests with no fulfilledBy', () => {
    const requests = [request({ fulfilled: false }), request({ fulfilled: true, fulfilledBy: null })];
    expect(buildCraftLeaderboard(requests)).toEqual([]);
  });

  it('returns an empty leaderboard for an empty request list', () => {
    expect(buildCraftLeaderboard([])).toEqual([]);
  });
});
