import { describe, expect, it } from 'vitest';
import { compareVersions, MAX_NOTES_SHOWN, notesToShow, RELEASE_NOTES, type ReleaseNote } from './releaseNotes';

const note = (version: string): ReleaseNote => ({ version, date: '2026-09-20', title: `Release ${version}`, highlights: [{ heading: 'A thing', body: 'It changed.' }] });

describe('compareVersions', () => {
  it('orders numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.1.2', '1.1.10')).toBe(-1);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
  });
});

describe('notesToShow', () => {
  const notes = [note('1.1.3'), note('1.1.2'), note('1.1.1')];

  it('shows the current version\'s note when nothing has been seen yet (first launch / fresh install)', () => {
    expect(notesToShow(notes, '1.1.3', null).map((n) => n.version)).toEqual(['1.1.3']);
  });

  it('shows nothing on a first launch when the current version has no note', () => {
    expect(notesToShow(notes, '1.1.4', null)).toEqual([]);
  });

  it('shows nothing once the current version has been seen', () => {
    expect(notesToShow(notes, '1.1.3', '1.1.3')).toEqual([]);
  });

  it('shows every note newer than the last one seen, newest first, so a skipped release is not lost', () => {
    expect(notesToShow(notes, '1.1.3', '1.1.0').map((n) => n.version)).toEqual(['1.1.3', '1.1.2', '1.1.1']);
    expect(notesToShow(notes, '1.1.3', '1.1.1').map((n) => n.version)).toEqual(['1.1.3', '1.1.2']);
  });

  it('never shows a note for a release newer than the running build', () => {
    expect(notesToShow(notes, '1.1.2', '1.1.0').map((n) => n.version)).toEqual(['1.1.2', '1.1.1']);
  });

  it('caps how many are shown at once', () => {
    const many = ['1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1'].map(note);
    expect(notesToShow(many, '1.2.5', '1.2.0')).toHaveLength(MAX_NOTES_SHOWN);
    expect(notesToShow(many, '1.2.5', '1.2.0')[0].version).toBe('1.2.5');
  });

  it('a build with no notes at all shows nothing', () => {
    expect(notesToShow([], '1.1.3', '1.1.0')).toEqual([]);
  });
});

describe('the shipped release notes', () => {
  it('are newest first, with one entry per version and something to say', () => {
    const versions = RELEASE_NOTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions);
    for (const n of RELEASE_NOTES) {
      expect(n.title.trim()).not.toBe('');
      expect(n.highlights.length).toBeGreaterThan(0);
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
