import { describe, expect, it } from 'vitest';
import { readLuaVariable } from './luaTableReader.cjs';

describe('readLuaVariable', () => {
  it('parses a realistic GuildToolsLootDB SavedVariables file', () => {
    const src = `
GuildToolsLootDB = {
	["records"] = {
		{
			["itemId"] = 12345,
			["itemLink"] = "|cffa335ee|Hitem:12345::::::::80:::::|h[Fancy Sword]|h|r",
			["winner"] = "Devkra",
			["boss"] = "Vashnik the Malignant",
			["time"] = 1735689600,
		},
		{
			["itemId"] = 999,
			["itemLink"] = "|cffa335ee|Hitem:999::::::::80:::::|h[Belt]|h|r",
			["winner"] = "Zalanto",
			["boss"] = nil,
			["time"] = 1735689700,
		},
	},
	["trades"] = {
		{
			["itemId"] = 999,
			["itemLink"] = "|cffa335ee|Hitem:999::::::::80:::::|h[Belt]|h|r",
			["from"] = "Zalanto",
			["to"] = "Harima",
			["time"] = 1735690000,
		},
	},
}
`;
    const db = readLuaVariable(src, 'GuildToolsLootDB');
    expect(db.records).toHaveLength(2);
    expect(db.records[0]).toEqual({
      itemId: 12345,
      itemLink: '|cffa335ee|Hitem:12345::::::::80:::::|h[Fancy Sword]|h|r',
      winner: 'Devkra',
      boss: 'Vashnik the Malignant',
      time: 1735689600,
    });
    expect(db.records[1].boss).toBeNull();
    expect(db.trades).toHaveLength(1);
    expect(db.trades[0].from).toBe('Zalanto');
    expect(db.trades[0].to).toBe('Harima');
  });

  it('returns an empty records/trades table for a fresh install', () => {
    const src = `GuildToolsLootDB = {\n\t["records"] = {\n\t},\n\t["trades"] = {\n\t},\n}\n`;
    const db = readLuaVariable(src, 'GuildToolsLootDB');
    expect(db.records).toEqual([]);
    expect(db.trades).toEqual([]);
  });

  it('returns null when the variable is not present', () => {
    expect(readLuaVariable('SomeOtherDB = {}', 'GuildToolsLootDB')).toBeNull();
  });

  it('ignores a leading comment header, as WoW writes to every SavedVariables file', () => {
    const src = `-- some comment header\n-- more comments\nGuildToolsLootDB = {\n\t["records"] = {\n\t},\n\t["trades"] = {\n\t},\n}\n`;
    const db = readLuaVariable(src, 'GuildToolsLootDB');
    expect(db.records).toEqual([]);
  });
});
