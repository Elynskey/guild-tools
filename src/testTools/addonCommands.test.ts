import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADDON_COMMANDS } from './addonCommands';

const lua = readFileSync('scripts/test-addon/test-extras.lua', 'utf8');
const helpBlock = lua.slice(lua.indexOf('local function testHelp()'), lua.indexOf('local copiedHandler'));

describe('test addon command cheat-sheet', () => {
  it('lists every command that the addon\'s own /gtloottest help prints', () => {
    for (const c of ADDON_COMMANDS) expect(helpBlock, `/gtloottest ${c.command} is not in the addon's help`).toContain(`/gtloottest ${c.command}`);
  });

  it('covers every test command the addon\'s help prints', () => {
    const inHelp = [...helpBlock.matchAll(/\/gtloottest ([a-z]+)/g)].map((m) => m[1]);
    const missing = [...new Set(inHelp)].filter((name) => !ADDON_COMMANDS.some((c) => c.command === name));
    expect(missing).toEqual([]);
  });

  it('every command answers what it does and when to use it', () => {
    for (const c of ADDON_COMMANDS) {
      expect(c.does.length).toBeGreaterThan(10);
      expect(c.when.length).toBeGreaterThan(5);
    }
    expect(new Set(ADDON_COMMANDS.map((c) => c.command)).size).toBe(ADDON_COMMANDS.length);
  });
});
