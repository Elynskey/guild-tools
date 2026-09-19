import { describe, expect, it } from 'vitest';
import { annotateWithTrades, buildSeasonLootReport, filterByRaider, formatNightForDiscord, groupLootByNight, needWinCount, needWinTally, type RawLootRecord, type RawNeedLossRecord, type RawTradeRecord } from './lootLogic';

function record(overrides: Partial<RawLootRecord> & Pick<RawLootRecord, 'time'>): RawLootRecord {
  return { itemId: 1, itemLink: '[Item]', winner: 'Grimsyl', boss: 'Vashnik the Malignant', ...overrides };
}

describe('annotateWithTrades', () => {
  it('matches a trade to its loot record within the trade window', () => {
    const records = [record({ time: 1000, itemId: 5, winner: 'Grimsyl' })];
    const trades: RawTradeRecord[] = [{ itemId: 5, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1500 }];
    const entries = annotateWithTrades(records, trades);
    expect(entries).toHaveLength(1);
    expect(entries[0].tradedTo).toBe('Zalanto');
    expect(entries[0].standaloneTrade).toBe(false);
  });

  it('carries a chat-tail source through unchanged', () => {
    const records = [record({ time: 1000, source: 'chat-tail' })];
    const entries = annotateWithTrades(records, []);
    expect(entries[0].source).toBe('chat-tail');
  });

  it('does not match a trade outside the 2-hour BoP window', () => {
    const records = [record({ time: 1000, itemId: 5, winner: 'Grimsyl' })];
    const trades: RawTradeRecord[] = [{ itemId: 5, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1000 + 3 * 60 * 60 }];
    const entries = annotateWithTrades(records, trades);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.standaloneTrade)).toBeTruthy();
  });

  it('creates a standalone entry for a trade with no matching win record', () => {
    const entries = annotateWithTrades([], [{ itemId: 9, itemLink: '[Item]', from: 'Harima', to: 'Thornwick', time: 2000 }]);
    expect(entries).toHaveLength(1);
    expect(entries[0].standaloneTrade).toBe(true);
    expect(entries[0].winner).toBe('Harima');
    expect(entries[0].tradedTo).toBe('Thornwick');
  });

  it('does not double-match the same record to two trades', () => {
    const records = [record({ time: 1000, itemId: 5, winner: 'Grimsyl' })];
    const trades: RawTradeRecord[] = [
      { itemId: 5, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1100 },
      { itemId: 5, itemLink: '[Item]', from: 'Grimsyl', to: 'Harima', time: 1200 },
    ];
    const entries = annotateWithTrades(records, trades);
    // Only one record existed -- the first trade consumes it, the second becomes standalone.
    expect(entries.filter((e) => !e.standaloneTrade)).toHaveLength(1);
    expect(entries.filter((e) => e.standaloneTrade)).toHaveLength(1);
  });
});

describe('slot', () => {
  it('carries the slot through from the raw record', () => {
    const entries = annotateWithTrades([record({ time: 1000, slot: 'Head' })], []);
    expect(entries[0].slot).toBe('Head');
  });

  it('defaults to null for records synced before slot existed', () => {
    const entries = annotateWithTrades([record({ time: 1000 })], []);
    expect(entries[0].slot).toBeNull();
  });

  it('is null for a standalone trade -- trades never carry slot', () => {
    const entries = annotateWithTrades([], [{ itemId: 9, itemLink: '[Item]', from: 'Harima', to: 'Thornwick', time: 2000 }]);
    expect(entries[0].slot).toBeNull();
  });
});

describe('groupLootByNight', () => {
  it('groups entries within a 6-hour window into one night', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000 }), record({ time: 2000 }), record({ time: 3000 })],
      [],
    );
    const nights = groupLootByNight(entries);
    expect(nights).toHaveLength(1);
    expect(nights[0].entries).toHaveLength(3);
  });

  it('splits into separate nights across a gap larger than 6 hours', () => {
    const sevenHours = 7 * 60 * 60;
    const entries = annotateWithTrades([record({ time: 1000 }), record({ time: 1000 + sevenHours })], []);
    const nights = groupLootByNight(entries);
    expect(nights).toHaveLength(2);
  });

  it('returns newest night first', () => {
    const sevenHours = 7 * 60 * 60;
    const entries = annotateWithTrades([record({ time: 1000 }), record({ time: 1000 + sevenHours })], []);
    const nights = groupLootByNight(entries);
    expect(nights[0].startTime).toBeGreaterThan(nights[1].startTime);
  });

  it('returns an empty array for no entries', () => {
    expect(groupLootByNight([])).toEqual([]);
  });
});

describe('filterByRaider', () => {
  it('includes entries the raider won and entries traded to the raider', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000, itemId: 1, winner: 'Grimsyl' })],
      [{ itemId: 1, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1100 }],
    );
    expect(filterByRaider(entries, 'Grimsyl')).toHaveLength(1);
    expect(filterByRaider(entries, 'Zalanto')).toHaveLength(1);
    expect(filterByRaider(entries, 'Harima')).toHaveLength(0);
  });
});

describe('needWinCount', () => {
  it('no longer counts a win against the original winner once traded away', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000, itemId: 1, winner: 'Grimsyl' })],
      [{ itemId: 1, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1100 }],
    );
    expect(needWinCount(entries, 'Grimsyl')).toBe(0);
    expect(needWinCount(entries, 'Zalanto')).toBe(0);
  });

  it('still counts a win the original winner kept (no trade)', () => {
    const entries = annotateWithTrades([record({ time: 1000, itemId: 1, winner: 'Grimsyl' })], []);
    expect(needWinCount(entries, 'Grimsyl')).toBe(1);
  });

  it('does not count a standalone trade as a win for the recipient', () => {
    const entries = annotateWithTrades([], [{ itemId: 1, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1000 }]);
    expect(needWinCount(entries, 'Zalanto')).toBe(0);
    expect(needWinCount(entries, 'Grimsyl')).toBe(0);
  });
});

describe('the 2-win Need cap is per difficulty', () => {
  const win = (time: number, itemId: number, difficulty: string | null, winner = 'Thundoor') => record({ time, itemId, itemLink: `[Item ${itemId}]`, winner, difficulty });
  const entriesFor = (records: RawLootRecord[]) => annotateWithTrades(records, []);

  it('2 Normal + 1 Heroic in one night is 3 wins but within the cap (the real Thundoor case)', () => {
    const tally = needWinTally(entriesFor([win(1000, 1, 'Normal'), win(2000, 2, 'Normal'), win(3000, 3, 'Heroic')]), 'Thundoor');
    expect(tally.total).toBe(3);
    expect(tally.capCount).toBe(2);
    expect(tally.byDifficulty).toEqual([
      { difficulty: 'Normal', count: 2 },
      { difficulty: 'Heroic', count: 1 },
    ]);
  });

  it('3 wins at the same difficulty is over the cap', () => {
    expect(needWinTally(entriesFor([win(1000, 1, 'Heroic'), win(2000, 2, 'Heroic'), win(3000, 3, 'Heroic')]), 'Thundoor').capCount).toBe(3);
  });

  it('a win with no recorded difficulty counts against the busiest known difficulty, so a possible breach is never hidden', () => {
    const tally = needWinTally(entriesFor([win(1000, 1, 'Normal'), win(2000, 2, 'Normal'), win(3000, 3, null)]), 'Thundoor');
    expect(tally.capCount).toBe(3);
    expect(tally.byDifficulty[tally.byDifficulty.length - 1]).toEqual({ difficulty: null, count: 1 });
  });

  it('old nights with no difficulty at all keep the plain per-night count', () => {
    expect(needWinTally(entriesFor([win(1000, 1, null), win(2000, 2, null), win(3000, 3, null)]), 'Thundoor').capCount).toBe(3);
    expect(needWinTally(entriesFor([win(1000, 1, null), win(2000, 2, null)]), 'Thundoor').capCount).toBe(2);
  });

  it('still leaves out traded-away items and other raiders', () => {
    const entries = annotateWithTrades(
      [win(1000, 1, 'Normal'), win(2000, 2, 'Normal'), win(2500, 9, 'Normal', 'Ranikina')],
      [{ itemId: 2, itemLink: '[Item 2]', from: 'Thundoor', to: 'Ranikina', time: 2600 }],
    );
    const tally = needWinTally(entries, 'Thundoor');
    expect(tally.total).toBe(1);
    expect(tally.capCount).toBe(1);
  });

  it('the season report does not flag 2 Normal + 1 Heroic on one night, but does flag 3 Normal', () => {
    const fine = buildSeasonLootReport(entriesFor([win(1000, 1, 'Normal'), win(2000, 2, 'Normal'), win(3000, 3, 'Heroic')]), ['Thundoor']);
    expect(fine[0].needWinCount).toBe(3);
    expect(fine[0].maxNeedWinsInNight).toBe(2);
    const breach = buildSeasonLootReport(entriesFor([win(1000, 1, 'Normal'), win(2000, 2, 'Normal'), win(3000, 3, 'Normal')]), ['Thundoor']);
    expect(breach[0].maxNeedWinsInNight).toBe(3);
  });
});

describe('formatNightForDiscord', () => {
  it('groups entries into one message per boss', () => {
    const entries = annotateWithTrades(
      [
        record({ time: 1000, itemId: 1, itemLink: '[Sword]', winner: 'Grimsyl', boss: 'Vashnik the Malignant', slot: 'Main Hand' }),
        record({ time: 1100, itemId: 2, itemLink: '[Shield]', winner: 'Thornwick', boss: 'Sszorak', slot: 'Off Hand' }),
        record({ time: 1200, itemId: 3, itemLink: '[Helm]', winner: 'Zalanto', boss: 'Vashnik the Malignant', slot: 'Head' }),
      ],
      [],
    );
    const messages = formatNightForDiscord(entries);
    expect(messages).toHaveLength(2);
    const vashnikMsg = messages.find((m) => m.startsWith('**Vashnik the Malignant**'))!;
    expect(vashnikMsg).toContain('Grimsyl won Sword (Main Hand)');
    expect(vashnikMsg).toContain('Zalanto won Helm (Head)');
    expect(messages.find((m) => m.startsWith('**Sszorak**'))).toContain('Thornwick won Shield (Off Hand)');
  });

  it('notes where a traded item ended up', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000, itemId: 1, itemLink: '[Ring]', winner: 'Grimsyl', boss: 'Sszorak' })],
      [{ itemId: 1, itemLink: '[Ring]', from: 'Grimsyl', to: 'Zalanto', time: 1100 }],
    );
    const [message] = formatNightForDiscord(entries);
    expect(message).toContain('Grimsyl won Ring');
    expect(message).toContain('traded to Zalanto');
  });

  it('groups a standalone trade under the no-boss heading', () => {
    const entries = annotateWithTrades([], [{ itemId: 1, itemLink: '[Ring]', from: 'Harima', to: 'Thornwick', time: 1000 }]);
    const [message] = formatNightForDiscord(entries);
    expect(message).toContain('No boss recorded');
    expect(message).toContain("Harima's Ring");
    expect(message).toContain('traded to Thornwick');
  });

  it('returns one message per boss, none empty, for an empty night', () => {
    expect(formatNightForDiscord([])).toEqual([]);
  });

  it('splits the same boss into separate messages per difficulty and labels the heading', () => {
    const entries = annotateWithTrades(
      [
        record({ time: 1000, itemId: 1, itemLink: '[Sword]', winner: 'Grimsyl', boss: 'Sszorak', difficulty: 'Normal' }),
        record({ time: 2000, itemId: 2, itemLink: '[Shield]', winner: 'Thornwick', boss: 'Sszorak', difficulty: 'Heroic' }),
      ],
      [],
    );
    const messages = formatNightForDiscord(entries);
    expect(messages).toHaveLength(2);
    expect(messages.find((m) => m.startsWith('**Sszorak (Normal)**'))).toContain('Grimsyl won Sword');
    expect(messages.find((m) => m.startsWith('**Sszorak (Heroic)**'))).toContain('Thornwick won Shield');
  });
});

describe('buildSeasonLootReport', () => {
  it('includes a roster member with zero wins', () => {
    const rows = buildSeasonLootReport([], ['Grimsyl']);
    expect(rows).toEqual([{ name: 'Grimsyl', needWinCount: 0, totalWon: 0, items: [], lastWonAt: null, maxNeedWinsInNight: 0, lossCount: 0, lostItems: [] }]);
  });

  it('counts every win toward totalWon but excludes a traded-away item from needWinCount', () => {
    const entries = annotateWithTrades(
      [
        record({ time: 1000, itemId: 1, itemLink: '[Sword]', winner: 'Grimsyl' }),
        record({ time: 2000, itemId: 2, itemLink: '[Shield]', winner: 'Grimsyl' }),
      ],
      [{ itemId: 1, itemLink: '[Sword]', from: 'Grimsyl', to: 'Zalanto', time: 1100 }],
    );
    const [row] = buildSeasonLootReport(entries, ['Grimsyl']);
    expect(row.totalWon).toBe(2); // both wins count, regardless of the trade
    expect(row.needWinCount).toBe(1); // only the kept item counts against the cap
    expect(row.items).toHaveLength(2);
    expect(row.items[0].itemLink).toBe('[Shield]'); // newest first
  });

  it('includes someone with wins even if they are not on the current roster list', () => {
    const entries = annotateWithTrades([record({ time: 1000, winner: 'FormerMember' })], []);
    const rows = buildSeasonLootReport(entries, ['Grimsyl']);
    expect(rows.map((r) => r.name)).toContain('FormerMember');
  });

  it('does not attribute a standalone trade to a winner', () => {
    const entries = annotateWithTrades([], [{ itemId: 1, itemLink: '[Ring]', from: 'Harima', to: 'Thornwick', time: 1000 }]);
    const rows = buildSeasonLootReport(entries, ['Harima']);
    const harima = rows.find((r) => r.name === 'Harima')!;
    expect(harima.totalWon).toBe(0);
    expect(harima.items).toHaveLength(0);
  });

  it('does not flag maxNeedWinsInNight when a season total over 2 is spread across nights (never over the cap on any one night)', () => {
    const sevenHours = 7 * 60 * 60;
    const entries = annotateWithTrades(
      [
        record({ time: 1000, itemId: 1, itemLink: '[A]', winner: 'Ranikina' }),
        record({ time: 2000, itemId: 2, itemLink: '[B]', winner: 'Ranikina' }),
        record({ time: 1000 + sevenHours, itemId: 3, itemLink: '[C]', winner: 'Ranikina' }),
      ],
      [],
    );
    const [row] = buildSeasonLootReport(entries, ['Ranikina']);
    expect(row.needWinCount).toBe(3); // season total, over 2 -- but not a cap breach
    expect(row.maxNeedWinsInNight).toBe(2); // 2 on the first night, 1 on the second -- cap held both nights
  });

  it('flags maxNeedWinsInNight when a raider actually exceeds the cap on one night', () => {
    const entries = annotateWithTrades(
      [
        record({ time: 1000, itemId: 1, itemLink: '[A]', winner: 'Grimsyl' }),
        record({ time: 2000, itemId: 2, itemLink: '[B]', winner: 'Grimsyl' }),
        record({ time: 3000, itemId: 3, itemLink: '[C]', winner: 'Grimsyl' }),
      ],
      [],
    );
    const [row] = buildSeasonLootReport(entries, ['Grimsyl']);
    expect(row.maxNeedWinsInNight).toBe(3);
  });

  it('counts losing Need rolls independently of wins', () => {
    const entries = annotateWithTrades([record({ time: 1000, itemId: 1, itemLink: '[Sword]', winner: 'Grimsyl' })], []);
    const losses: RawNeedLossRecord[] = [
      { itemId: 2, itemLink: '[Shield]', name: 'Grimsyl', boss: 'Sszorak', time: 2000 },
      { itemId: 3, itemLink: '[Helm]', name: 'Grimsyl', boss: 'Sszorak', time: 3000 },
    ];
    const [row] = buildSeasonLootReport(entries, ['Grimsyl'], losses);
    expect(row.totalWon).toBe(1);
    expect(row.lossCount).toBe(2);
    expect(row.lostItems).toHaveLength(2);
    expect(row.lostItems[0].itemLink).toBe('[Helm]'); // newest first
  });

  it('gives a roster member with zero losses a lossCount of 0', () => {
    const [row] = buildSeasonLootReport([], ['Grimsyl'], []);
    expect(row.lossCount).toBe(0);
    expect(row.lostItems).toEqual([]);
  });

  it('includes a raider who only ever lost rolls, never won', () => {
    const losses: RawNeedLossRecord[] = [{ itemId: 1, itemLink: '[Ring]', name: 'Harima', boss: 'Sszorak', time: 1000 }];
    const rows = buildSeasonLootReport([], ['Grimsyl'], losses);
    const harima = rows.find((r) => r.name === 'Harima')!;
    expect(harima).toBeTruthy();
    expect(harima.totalWon).toBe(0);
    expect(harima.lossCount).toBe(1);
  });

  it('sets lastWonAt to the most recent win', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000, itemId: 1 }), record({ time: 5000, itemId: 2 })],
      [],
    );
    const [row] = buildSeasonLootReport(entries, ['Grimsyl']);
    expect(row.lastWonAt).toBe(5000);
  });

  it('carries difficulty through to both won and lost items', () => {
    const entries = annotateWithTrades([record({ time: 1000, itemId: 1, difficulty: 'Heroic' })], []);
    const losses: RawNeedLossRecord[] = [{ itemId: 2, itemLink: '[Shield]', name: 'Grimsyl', boss: 'Sszorak', time: 2000, difficulty: 'Normal' }];
    const [row] = buildSeasonLootReport(entries, ['Grimsyl'], losses);
    expect(row.items[0].difficulty).toBe('Heroic');
    expect(row.lostItems[0].difficulty).toBe('Normal');
  });
});
