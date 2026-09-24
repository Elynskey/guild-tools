-- The C_LootHistory capture path, with the game's per-drop ID (lootListID): every win and lost roll carries the encounter
-- and the drop it came from, and two rolls on two copies of one item are two rolls, not one seen twice.
local printed = {}
local function noop() end

local frames = {}
local frameMethods = {}
frameMethods.__index = function(t) return function() return t end end
function CreateFrame()
  local f = setmetatable({ scripts = {}, shown = false, events = {} }, frameMethods)
  f.SetScript = function(self, name, fn) self.scripts[name] = fn end
  f.GetScript = function(self, name) return self.scripts[name] end
  f.Show = function(self) self.shown = true end
  f.Hide = function(self) self.shown = false end
  f.IsShown = function(self) return self.shown == true end
  f.RegisterEvent = function(self, ev) self.events[ev] = true end
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
IsInRaid = function() return true end
IsInGroup = function() return true end
C_Timer = { After = function(_, fn) fn() end }
C_ChatInfo = { IsLoggingChat = function() return true end }
LoggingChat = noop
SlashCmdList = {}
IsInInstance = function() return true, "raid" end
GetInstanceInfo = function() return "The Venomous Abyss", "raid", 17, "", 25, 0, false, 3004 end
GetDifficultyInfo = function(id) return ({ [17] = "Looking For Raid", [15] = "Heroic" })[id] end
GetItemInfoInstant = function() return 25, "Armor", "Cloth", "INVTYPE_CLOAK", 0, 4, 1 end
GetItemInfo = function() return "Some Cloak", nil, 4, 1, 1, "Armor", "Cloth", 1, "INVTYPE_CLOAK" end
INVTYPE_CLOAK = "Back"
C_ToyBox = nil

Enum = { EncounterLootDropRollState = { NeedMainSpec = 1, NeedOffSpec = 2, Greed = 3 } }
local drops = {}
C_LootHistory = {
  GetSortedInfoForDrop = function(encounterID, lootListID) return drops[encounterID .. ":" .. lootListID] end,
  GetSortedDropsForEncounter = function() return {} end,
  GetAllEncounterInfos = function() return {} end,
}

GuildToolsLootTestDB = nil
dofile("addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")
local frame = frames[1]

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end

local function link(id, name) return "|cnIQ4:|Hitem:" .. id .. "::::::::90:577::4:3:6652:13332:12825::::::|h[" .. name .. "]|h|r" end
local SHAWL = link(268248, "Amani Summoning Shawl")

-- One drop: `winner` won, everyone in `losers` rolled Need and lost. Fires the game's LOOT_HISTORY_UPDATE_DROP.
local function drop(encounterID, lootListID, item, winner, losers)
  local rolls = { { isWinner = true, state = 1, playerName = winner } }
  for _, name in ipairs(losers or {}) do rolls[#rolls + 1] = { isWinner = false, state = 1, playerName = name } end
  drops[encounterID .. ":" .. lootListID] = { winner = { playerName = winner }, itemHyperlink = item, rollInfos = rolls }
  frame.scripts.OnEvent(frame, "LOOT_HISTORY_UPDATE_DROP", encounterID, lootListID)
end

local function count(list, pred)
  local n = 0
  for _, r in ipairs(list) do if pred(r) then n = n + 1 end end
  return n
end

frame.scripts.OnEvent(frame, "ENCOUNTER_START", 3470, "Nek'zali the Soulcoiler")
local db = GuildToolsLootTestDB

drop(3470, 1, SHAWL, "Mooingshots", { "Victorix", "Beep" })
check("a win records the encounter and the game's ID for the drop", #db.records == 1 and db.records[1].encounterId == 3470 and db.records[1].lootListId == 1, tostring(db.records[1] and db.records[1].lootListId))
check("...and so does every lost roll", #db.needLosses == 2 and db.needLosses[1].encounterId == 3470 and db.needLosses[1].lootListId == 1 and db.needLosses[2].lootListId == 1)

drop(3470, 1, SHAWL, "Mooingshots", { "Victorix", "Beep" })
check("seeing the SAME drop again (a rescan, a second event) adds nothing", #db.records == 1 and #db.needLosses == 2, #db.records .. "/" .. #db.needLosses)

-- two copies of one item drop: the same person can lose both rolls
drop(3470, 2, SHAWL, "Dorian", { "Victorix" })
drop(3470, 3, SHAWL, "Ellis", { "Victorix", "Beep" })
check("two copies of an item are two drops: both wins are recorded", #db.records == 3, tostring(#db.records))
check("...and someone who lost BOTH rolls has two lost-roll entries, one per drop", count(db.needLosses, function(r) return r.name == "Victorix" end) == 3 and count(db.needLosses, function(r) return r.name == "Victorix" and r.lootListId == 2 end) == 1 and count(db.needLosses, function(r) return r.name == "Victorix" and r.lootListId == 3 end) == 1)

drop(3470, 2, SHAWL, "Dorian", { "Victorix" })
drop(3470, 3, SHAWL, "Ellis", { "Victorix", "Beep" })
check("re-seeing either copy still adds nothing", #db.records == 3 and count(db.needLosses, function(r) return r.name == "Victorix" end) == 3, #db.records .. "/" .. #db.needLosses)

-- the same person winning both copies
drop(3470, 4, SHAWL, "Greedy", {})
drop(3470, 5, SHAWL, "Greedy", {})
check("one person winning both copies is two wins, not one", count(db.records, function(r) return r.winner == "Greedy" end) == 2, tostring(count(db.records, function(r) return r.winner == "Greedy" end)))

-- the chat-text path (no drop ID) sighting the same win afterwards is the same win
local before = #db.records
frame.scripts.OnEvent(frame, "CHAT_MSG_LOOT", "|HlootHistory:3470|h[Loot]|h: Mooingshots (Need - 75, Main-Spec) Won: " .. SHAWL)
check("the chat-text path (no drop ID) seeing an already-recorded win adds nothing", #db.records == before, tostring(#db.records))

-- a different encounter's drop of the same item to the same loser is a different roll
frame.scripts.OnEvent(frame, "ENCOUNTER_START", 3471, "Another Boss")
drop(3471, 1, SHAWL, "Mooingshots", { "Victorix" })
check("the same item and loser on a DIFFERENT boss is a different roll and is recorded", count(db.needLosses, function(r) return r.name == "Victorix" and r.encounterId == 3471 end) == 1)
check("...and the win too", count(db.records, function(r) return r.winner == "Mooingshots" and r.encounterId == 3471 end) == 1)

-- /gtloottest drops: asks the game's loot history what it knows and saves the answer
C_LootHistory.GetSortedDropsForEncounter = function(id) if id == 3471 then return { { lootListID = 1, itemHyperlink = "x" } } end return {} end
printed = {}
local okDrops, errDrops = pcall(SlashCmdList["GUILDTOOLSLOOTTEST"], "drops")
local probe = GuildToolsLootTestDB.dropProbe
check("drops runs and saves what the game answered", okDrops and probe and probe.apis.GetSortedInfoForDrop == true and probe.states.NeedMainSpec == 1, tostring(errDrops))
local enc3471
for _, e in ipairs(probe and probe.encounters or {}) do if e.id == 3471 then enc3471 = e end end
check("...including the drops of each encounter it knows, with the roll details", enc3471 and enc3471.drops == 1 and enc3471.samples[1].info and enc3471.samples[1].info:find("winner", 1, true) and #enc3471.samples[1].rolls >= 1, enc3471 and tostring(enc3471.samples[1].info) or "no 3471")
check("...and prints a summary", table.concat(printed, " "):find("the game lists 1 drop", 1, true) ~= nil)
local savedLH, savedEnum = C_LootHistory, Enum
C_LootHistory = nil
Enum = nil
local okNone = pcall(SlashCmdList["GUILDTOOLSLOOTTEST"], "drops")
check("with no C_LootHistory at all it says so instead of erroring", okNone and GuildToolsLootTestDB.dropProbe.apis.GetSortedInfoForDrop == false)
C_LootHistory = savedLH
Enum = savedEnum

-- the diagnostics hook names the first check a drop event fails
local diagFrame
for _, f in ipairs(frames) do if f ~= frame and f.events.LOOT_HISTORY_UPDATE_DROP then diagFrame = f end end
check("the drop-event diagnostics hook exists", diagFrame ~= nil)
if diagFrame then
  GuildToolsLootTestDB.dropEvents = nil
  drops["3480:1"] = { winner = { playerName = "W" }, itemHyperlink = SHAWL, rollInfos = { { isWinner = true, state = 1, playerName = "W" } } }
  drops["3480:2"] = { winner = { playerName = "W" }, itemHyperlink = SHAWL, rollInfos = { { state = 1, playerName = "W" } } }
  drops["3480:3"] = { winner = { playerName = "W" }, itemHyperlink = SHAWL, rollInfos = { { isWinner = true, state = 3, playerName = "W" } } }
  for i = 1, 4 do diagFrame.scripts.OnEvent(diagFrame, "LOOT_HISTORY_UPDATE_DROP", 3480, i) end
  local r = GuildToolsLootTestDB.dropEvents.reasons
  check("...counts a drop that would be recorded, one with no winning roll, one whose winner rolled Greed, and one with no info", GuildToolsLootTestDB.dropEvents.count == 4 and r.wouldRecord == 1 and r.noRollHasIsWinner == 1 and r["winnerNotNeed(state=3)"] == 1 and r.noInfo == 1)
  diagFrame.scripts.OnEvent(diagFrame, "LOOT_HISTORY_UPDATE_DROP", 3480, 1)
  local last = GuildToolsLootTestDB.dropEvents.last
  check("...and keeps the shape of a roll for the last event", last.reason == "wouldRecord" and last.rollShapes[1] and last.rollShapes[1]:find("isWinner=true", 1, true) and last.winner:find("playerName=W", 1, true), tostring(last.rollShapes[1]))
end

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
