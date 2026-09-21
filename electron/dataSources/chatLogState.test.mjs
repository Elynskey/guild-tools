import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deriveChatLogState, isLoggingOn } = require('./chatLogState.cjs');

const on = { on: true, at: 1 };
const off = { on: false, at: 1 };

describe('deriveChatLogState', () => {
  it('a recent write is proof of logging, whatever the saved reading says', () => {
    expect(deriveChatLogState({ active: true, gameReading: null })).toBe('writing');
    expect(deriveChatLogState({ active: true, gameReading: off })).toBe('writing');
  });

  it('a stale file with the game saying ON is buffering, not "off" (the false alarm this exists to stop)', () => {
    expect(deriveChatLogState({ active: false, gameReading: on })).toBe('on-buffered');
  });

  it('only the game saying OFF is reported as off', () => {
    expect(deriveChatLogState({ active: false, gameReading: off })).toBe('off');
  });

  it('a stale file and no reading is "unknown", never "off"', () => {
    expect(deriveChatLogState({ active: false, gameReading: null })).toBe('unknown');
  });
});

describe('isLoggingOn', () => {
  it('counts writing and on-buffered; unknown and off are not a yes', () => {
    expect(isLoggingOn('writing')).toBe(true);
    expect(isLoggingOn('on-buffered')).toBe(true);
    expect(isLoggingOn('off')).toBe(false);
    expect(isLoggingOn('unknown')).toBe(false);
  });
});
