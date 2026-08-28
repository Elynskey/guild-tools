import { describe, expect, it } from 'vitest';
import { annotateWithTrades, filterByRaider, groupLootByNight, needWinCount, type RawLootRecord, type RawTradeRecord } from './lootLogic';

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
  it('counts wins even after the item was traded away', () => {
    const entries = annotateWithTrades(
      [record({ time: 1000, itemId: 1, winner: 'Grimsyl' })],
      [{ itemId: 1, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1100 }],
    );
    expect(needWinCount(entries, 'Grimsyl')).toBe(1);
    expect(needWinCount(entries, 'Zalanto')).toBe(0);
  });

  it('does not count a standalone trade as a win for the recipient', () => {
    const entries = annotateWithTrades([], [{ itemId: 1, itemLink: '[Item]', from: 'Grimsyl', to: 'Zalanto', time: 1000 }]);
    expect(needWinCount(entries, 'Zalanto')).toBe(0);
    expect(needWinCount(entries, 'Grimsyl')).toBe(0);
  });
});
