-- Real addon vs generated TEST addon in one mocked WoW client: what each one tracks, and the self-test.
local printed = {}
local function noop() end

local frames = {}
local frameMethods = {}
frameMethods.__index = function(t, k)
  return function() return t end
end
function CreateFrame()
  local f = setmetatable({ scripts = {} }, frameMethods)
  f.SetScript = function(self, name, fn) self.scripts[name] = fn end
  f.GetScript = function(self, name) return self.scripts[name] end
  frames[#frames + 1] = f
  return f
end
UIParent = {}
DEFAULT_CHAT_FRAME = { AddMessage = function(_, m) printed[#printed + 1] = m end }
StaticPopupDialogs = {}
StaticPopup_Show = noop
GetTime = function() return 0 end
date = os.date
time = os.time
UnitName = function() return "Tester" end
UnitFullName = function() return "Tester", "ArgentDawn" end
GetUnitName = function() return "Tester-ArgentDawn" end
GetRealmName = function() return "Argent Dawn" end
IsInRaid = function() return false end
IsInGroup = function() return true end
C_Timer = { After = function(_, fn) fn() end }
C_LootHistory = nil
C_ToyBox = nil
Enum = nil

-- the zone the "player" is standing in, changed per scenario
local env = { inInstance = true, instanceType = "party", name = "Some Dungeon", difficultyID = 23 }
IsInInstance = function() return env.inInstance, env.instanceType end
GetInstanceInfo = function() return env.name, env.instanceType, env.difficultyID, "", 5, 0, false, 999 end
local DIFFICULTY_NAMES = { [14] = "Normal", [15] = "Heroic", [16] = "Mythic", [17] = "Raid Finder", [23] = "Mythic", [208] = "Delves" }
GetDifficultyInfo = function(id) return DIFFICULTY_NAMES[id] end
GetItemInfoInstant = function() return 25, "Weapon", "One-Handed Swords", "INVTYPE_WEAPON", 0, 2, 7 end
GetItemInfo = function() return "Worn Shortsword", nil, 1, 1, 1, "Weapon", "Swords", 1, "INVTYPE_WEAPON" end
INVTYPE_WEAPON = "One-Hand"

local state = false
C_ChatInfo = { IsLoggingChat = function() return state end }
LoggingChat = function(on) state = on end
SlashCmdList = {}
GuildToolsLootDB = nil
GuildToolsLootTestDB = nil

local function load(path)
  local before = #frames
  local ok, err = pcall(dofile, path)
  assert(ok, "load error in " .. path .. ": " .. tostring(err))
  return frames[before + 1] -- the addon's main frame is the first one it creates
end
local realFrame = load("addon/GuildToolsLoot/GuildToolsLoot.lua")
local testFrame = load("addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end

local n = 0
local function link(id) return "|cffffffff|Hitem:" .. id .. "::::::::1:::::::|h[Item " .. id .. "]|h|r" end
local function win(frame, winner)
  n = n + 1
  frame.scripts.OnEvent(frame, "CHAT_MSG_LOOT", "[Loot]: " .. winner .. " (Need - 77) Won: " .. link(1000 + n))
end
local function say(cmd, msg)
  printed = {}
  SlashCmdList[cmd](msg)
  return table.concat(printed, " || ")
end
local function zone(inInstance, instanceType, name, difficultyID)
  env.inInstance, env.instanceType, env.name, env.difficultyID = inInstance, instanceType, name, difficultyID
end

-- =========================== the REAL addon stays strict ===========================
GuildToolsLootDB.records = {}
zone(true, "party", "Some Dungeon", 23)
win(realFrame, "Alpha")
check("REAL addon ignores a Mythic dungeon win", #GuildToolsLootDB.records == 0)
zone(true, "raid", "The Venomous Abyss", 17)
win(realFrame, "Alpha")
check("REAL addon ignores a Raid Finder win", #GuildToolsLootDB.records == 0)
zone(true, "raid", "Some Old Raid", 15)
win(realFrame, "Alpha")
check("REAL addon ignores another raid", #GuildToolsLootDB.records == 0)
zone(true, "raid", "The Venomous Abyss", 15)
realFrame.scripts.OnEvent(realFrame, "ENCOUNTER_START", 222, "Raid Boss")
win(realFrame, "Alpha")
check("REAL addon still records this tier's Heroic raid", #GuildToolsLootDB.records == 1 and GuildToolsLootDB.records[1].difficulty == "Heroic")
check("...and its records have no test-only fields", GuildToolsLootDB.records[1].zone == nil and GuildToolsLootDB.records[1].contentType == nil)

-- =========================== the TEST addon tracks everything ===========================
GuildToolsLootTestDB.records = {}
local cases = {
  { "Mythic dungeon", true, "party", "Some Dungeon", 23, "party", "Mythic" },
  { "delve", true, "scenario", "A Delve", 208, "scenario", "Delves" },
  { "Raid Finder raid", true, "raid", "The Venomous Abyss", 17, "raid", "Raid Finder" },
  { "another raid, Mythic", true, "raid", "Some Old Raid", 16, "raid", "Mythic" },
  { "this tier's Heroic raid", true, "raid", "The Venomous Abyss", 15, "raid", "Heroic" },
  { "open world", false, "none", "Isle of Somewhere", 0, "none", nil },
}
for _, c in ipairs(cases) do
  zone(c[2], c[3], c[4], c[5])
  local before = #GuildToolsLootTestDB.records
  win(testFrame, "Bravo")
  local r = GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records]
  check("TEST addon records: " .. c[1], #GuildToolsLootTestDB.records == before + 1 and r.zone == c[4] and r.contentType == c[6] and r.difficulty == c[7], r and (tostring(r.zone) .. " / " .. tostring(r.contentType) .. " / " .. tostring(r.difficulty)))
end
check("...and none of that touched the real addon's records", #GuildToolsLootDB.records == 1)

-- boss context: a boss from one instance must not stick to loot from the next
zone(true, "party", "Some Dungeon", 23)
testFrame.scripts.OnEvent(testFrame, "ENCOUNTER_START", 111, "Dungeon Boss")
win(testFrame, "Charlie")
local r = GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records]
check("a win after a dungeon boss carries that boss and the dungeon's difficulty", r.boss == "Dungeon Boss" and r.difficulty == "Mythic", tostring(r.boss) .. " / " .. tostring(r.difficulty))
zone(true, "scenario", "A Delve", 208)
testFrame.scripts.OnEvent(testFrame, "PLAYER_ENTERING_WORLD")
win(testFrame, "Delta")
r = GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records]
check("entering a new instance clears the old boss", r.boss == nil and r.zone == "A Delve", tostring(r.boss))

-- strict mode puts the real rules back
say("GUILDTOOLSLOOTTEST", "track strict")
local before = #GuildToolsLootTestDB.records
zone(true, "party", "Some Dungeon", 23)
win(testFrame, "Echo")
check("track strict: a dungeon win is ignored again", #GuildToolsLootTestDB.records == before)
zone(true, "raid", "The Venomous Abyss", 15)
win(testFrame, "Echo")
check("track strict: this tier's Heroic raid is still recorded", #GuildToolsLootTestDB.records == before + 1)
local out = say("GUILDTOOLSLOOTTEST", "track all")
check("track all restores everything", GuildToolsLootTestDB.trackAll == true and out:find("ALL content"), out)

-- =========================== the self-test ===========================
zone(true, "party", "Some Dungeon", 23)
before = #GuildToolsLootTestDB.records
out = say("GUILDTOOLSLOOTTEST", "selftest")
check("selftest PASSES in a dungeon with tracking on all, and names where", out:find("SELF%-TEST PASSED") and out:find("Some Dungeon"), out)
check("...and cleans up its fake win", #GuildToolsLootTestDB.records == before)

say("GUILDTOOLSLOOTTEST", "track strict")
out = say("GUILDTOOLSLOOTTEST", "selftest")
check("selftest FAILS in strict mode in a dungeon and says why", out:find("SELF%-TEST FAILED") and out:find("STRICT"), out)
say("GUILDTOOLSLOOTTEST", "track all")

GuildToolsLootTestDB.enabled = false
out = say("GUILDTOOLSLOOTTEST", "selftest")
check("selftest still checks the capture even when logging is off (and restores the setting)", out:find("SELF%-TEST PASSED") and GuildToolsLootTestDB.enabled == false, out)
GuildToolsLootTestDB.enabled = true

-- =========================== /last ===========================
out = say("GUILDTOOLSLOOTTEST", "last 3")
check("last shows recent captures with where each came from", out:find("Need win%(s%)") and out:find("Delve") and out:find("Tracking: ALL"), out)
GuildToolsLootTestDB.records = {}
out = say("GUILDTOOLSLOOTTEST", "last")
check("last with nothing captured points at selftest", out:find("nothing captured yet") and out:find("selftest"), out)

out = say("GUILDTOOLSLOOTTEST", "help")
check("help lists track, last and selftest", out:find("track") and out:find("last") and out:find("selftest"), out)

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
