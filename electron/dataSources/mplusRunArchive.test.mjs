import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
let archive;

const run = (id, day, season = 'season-mn-2') => ({
  dungeon: 'Murder Row',
  level: 10,
  completedAt: `2026-09-${String(day).padStart(2, '0')}T20:00:00.000Z`,
  upgrades: 1,
  url: `https://raider.io/mythic-plus-runs/${season}/${id}-10-murder-row`,
});

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-mplus-'));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  archive = await import('./mplusRunArchive.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('recordSeasonRuns', () => {
  it('keeps keys that have dropped out of what Raider.IO lists now', () => {
    archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(1, 1), run(2, 2)] }]);
    const out = archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(3, 3)] }]);
    expect(out['A::realm'].map((r) => r.url.split('/').pop())).toEqual(['3-10-murder-row', '2-10-murder-row', '1-10-murder-row']);
  });

  it('counts a key seen again once', () => {
    archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(1, 1)] }]);
    expect(archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(1, 1)] }])['A::realm']).toHaveLength(1);
  });

  it('starts over when a new season begins', () => {
    archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(1, 1, 'season-mn-2')] }]);
    const out = archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(9, 5, 'season-mn-3')] }]);
    expect(out['A::realm']).toHaveLength(1);
    expect(archive.seasonOf(out['A::realm'][0].url)).toBe('season-mn-3');
  });

  it('keeps the archive when a character shows no runs this fetch', () => {
    archive.recordSeasonRuns([{ key: 'A::realm', runs: [run(1, 1)] }]);
    expect(archive.recordSeasonRuns([{ key: 'A::realm', runs: [] }])['A::realm']).toHaveLength(1);
  });

  it('a backfilled copy (no URL) never replaces the linked one, but fills in keys it lacks', () => {
    archive.recordSeasonRuns([{ key: 'A::realm', runs: [{ ...run(1, 1), role: 'tank' }] }]);
    const backfilled = [{ ...run(1, 1), url: '', role: null }, { ...run(2, 2), url: '', role: null }];
    const out = archive.recordSeasonRuns([{ key: 'A::realm', runs: backfilled, backfilledAt: 123 }])['A::realm'];
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.completedAt.startsWith('2026-09-01'))).toMatchObject({ role: 'tank', url: run(1, 1).url });
    expect(archive.lastBackfilledAt('A::realm')).toBe(123);
  });

  it('files nothing for a character whose season it has never seen', () => {
    expect(archive.recordSeasonRuns([{ key: 'B::realm', runs: [{ ...run(1, 1), url: '' }] }])['B::realm']).toBeUndefined();
  });
});
