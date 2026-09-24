import { describe, expect, it } from 'vitest';
import { parseCharacter } from './MythicPlusComp';

describe('parseCharacter', () => {
  it('reads a bare name as the guild realm', () => {
    expect(parseCharacter(' Narima ')).toEqual({ name: 'Narima', realm: null });
  });

  it('splits Name-Realm, and spaces out a realm written without spaces (as the calendar does)', () => {
    expect(parseCharacter('Odasa-ArgentDawn')).toEqual({ name: 'Odasa', realm: 'Argent Dawn' });
    expect(parseCharacter('Zakainu-Feathermoon')).toEqual({ name: 'Zakainu', realm: 'Feathermoon' });
    expect(parseCharacter('Devkra-The Scryers')).toEqual({ name: 'Devkra', realm: 'The Scryers' });
  });
});
