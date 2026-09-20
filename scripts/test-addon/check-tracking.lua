-- Real addon vs generated TEST addon in one mocked WoW client: what each one tracks, and the self-test.
local printed = {}
local function noop() end

local frames = {}
local frameMethods = {}
frameMethods.__index = function(t, k)
  return function() return t end
end
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


-- =========================== the checklist overlay ===========================
GuildToolsLootTestDB.records = {}
GuildToolsLootTestDB.needLosses = {}
GuildToolsLootTestDB.checklist = {}
GuildToolsLootTestDB.checklistHidden = nil
say("GUILDTOOLSLOOTTEST", "checklist reset")
zone(true, "party", "Some Dungeon", 23)

out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("the text checklist lists every item", select(2, out:gsub("%[[ x!]%]", "")) == 14, out:sub(1, 200))
check("...the auto items start with only 'loaded' ticked", out:find("%[x%] loaded") and out:find("%[ %] win") and out:find("%[ %] selftest"))

state = true
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("chat logging ticks live from the game's own reading", out:find("%[x%] chatlog"), "")
state = false
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("...and shows failed when it reads OFF", out:find("%[!%] chatlog"), "")
state = true

say("GUILDTOOLSLOOTTEST", "selftest")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a passing self-test ticks its item", out:find("%[x%] selftest"), "")
check("...but does NOT tick 'a real win captured' (the fake win is not real)", out:find("%[ %] win"), "")

-- a real win in a dungeon, seen by the poll
win(testFrame, "Foxtrot")
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a real win ticks 'win' and the DUNGEON item", out:find("%[x%] win") and out:find("%[x%] dungeon") and out:find("%[ %] raid"), "")

-- a raid win and a lost roll in a delve
zone(true, "raid", "Some Old Raid", 16)
win(testFrame, "Golf")
GuildToolsLootTestDB.needLosses[#GuildToolsLootTestDB.needLosses + 1] = { itemId = 9, name = "Hotel", time = time(), contentType = "scenario", zone = "A Delve" }
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a raid win ticks RAID; a lost roll in a delve ticks 'loss' and DELVE", out:find("%[x%] raid") and out:find("%[x%] loss") and out:find("%[x%] delve"), "")

-- manual items
out = say("GUILDTOOLSLOOTTEST", "check marker")
check("check marker: first click = done", out:find("done") and GuildToolsLootTestDB.checklist.marker == "pass", out)
out = say("GUILDTOOLSLOOTTEST", "check marker")
check("...second = FAILED", out:find("FAILED") and GuildToolsLootTestDB.checklist.marker == "fail", out)
out = say("GUILDTOOLSLOOTTEST", "check marker")
check("...third = cleared", out:find("cleared") and GuildToolsLootTestDB.checklist.marker == nil, out)
out = say("GUILDTOOLSLOOTTEST", "check win")
check("an auto item can't be ticked by hand", out:find("ticks itself"), out)
out = say("GUILDTOOLSLOOTTEST", "check nonsense")
check("an unknown id lists the manual ones", out:find("marker, live_app, reload, discord, verify"), out)

-- the on-screen overlay
local before = #frames
GuildToolsLootTestDB.checklistHidden = nil
say("GUILDTOOLSLOOTTEST", "checklist")
local overlay
for i = before + 1, #frames do if frames[i].shown then overlay = frames[i] end end
check("/gtloottest checklist builds and shows the overlay", overlay ~= nil and GuildToolsLootTestDB.checklistHidden == false)
say("GUILDTOOLSLOOTTEST", "checklist")
check("running it again hides it (and remembers that)", overlay.shown == false and GuildToolsLootTestDB.checklistHidden == true, "shown=" .. tostring(overlay.shown) .. " hidden=" .. tostring(GuildToolsLootTestDB.checklistHidden) .. " newFrames=" .. (#frames - before))
say("GUILDTOOLSLOOTTEST", "checklist")
check("...and again shows it", overlay.shown == true and GuildToolsLootTestDB.checklistHidden == false)

-- state survives: it lives in the saved variables table
check("checklist state is kept in the test addon's saved variables", type(GuildToolsLootTestDB.checklist) == "table" and GuildToolsLootTestDB.checklist.win == "pass")
say("GUILDTOOLSLOOTTEST", "checklist reset")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("reset clears the ticks (win is unticked again)", out:find("%[ %] win"), "")

-- if the window can't be drawn, the addon says so and prints the list instead of erroring
local realCreateFrame = CreateFrame
GuildToolsLootTestDB.checklistHidden = true
-- rebuild path: forget the built frame by loading a fresh copy of the test addon in a client whose UI templates fail
CreateFrame = function(kind, name, parent, template)
  if template == "BackdropTemplate" then error("template not available") end
  return realCreateFrame(kind, name, parent, template)
end
local okLoad, errLoad = pcall(dofile, "addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")
check("a client where the window can't be built still loads the addon", okLoad, tostring(errLoad))
out = say("GUILDTOOLSLOOTTEST", "checklist")
check("...and shows the checklist as chat text instead of erroring", out:find("couldn't draw the checklist window") and out:find("%[[ x!]%]"), out:sub(1, 200))
CreateFrame = realCreateFrame

out = say("GUILDTOOLSLOOTTEST", "help")
check("help mentions the checklist and the manual items", out:find("checklist") and out:find("live_app"), "")

-- =========================== raw loot lines + debug ===========================
local lootLineFrame
for i = #frames, 1, -1 do
  local f = frames[i]
  if f ~= testFrame and f ~= realFrame and f.events and f.events.CHAT_MSG_LOOT then lootLineFrame = f break end
end
check("a dedicated frame listens for CHAT_MSG_LOOT to keep the raw lines", lootLineFrame ~= nil)

GuildToolsLootTestDB.lootLines = nil
GuildToolsLootTestDB.lootLineStats = nil
zone(true, "raid", "The Venomous Abyss", 15)
local needLine = "[Loot]: Thundoor (Need - 88) Won: " .. link(4001)
local greedLine = "[Loot]: Devkra (Greed - 12) Won: " .. link(4002)
local oddLine = "Loot: Someone has a completely different shape " .. link(4003)
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", needLine)
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", greedLine)
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", oddLine)
local kept = GuildToolsLootTestDB.lootLines
check("every loot line is kept as the game sent it, with where it happened", #kept == 3 and kept[1].text == needLine and kept[1].zone == "The Venomous Abyss" and kept[1].difficultyID == 15)
check("...and marked as a Need win or not by the addon's own pattern", kept[1].matches == true and kept[2].matches == false and kept[3].matches == false)
out = say("GUILDTOOLSLOOTTEST", "lootlines 5")
check("lootlines shows them newest first with the verdict", out:find("3 loot line") and out:find("%[NEED WIN%]") and out:find("%[not a need win%]") and out:find("Thundoor"), out:sub(1, 300))

-- the buffer is capped
for i = 1, 100 do lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", "[Loot]: P" .. i .. " (Need - 1) Won: " .. link(5000 + i)) end
check("the raw-line buffer is capped at 80, newest kept", #GuildToolsLootTestDB.lootLines == 80 and GuildToolsLootTestDB.lootLines[80].text:find("P100 "), tostring(#GuildToolsLootTestDB.lootLines))
check("...while the counter keeps the true total", GuildToolsLootTestDB.lootLineStats.seen == 103, tostring(GuildToolsLootTestDB.lootLineStats.seen))

-- protected ("secret") values are counted, never crash
issecretvalue = function(v) return v == "SECRET" end
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", "SECRET")
check("a protected value is counted and skipped without error", GuildToolsLootTestDB.lootLineStats.secret == 1 and #GuildToolsLootTestDB.lootLines == 80)
out = say("GUILDTOOLSLOOTTEST", "lootlines 1")
check("...and lootlines tells you how many were unreadable", out:find("1 were protected"), out:sub(1, 200))
issecretvalue = nil

-- a non-string payload can't break the game's event either
local okNil = pcall(lootLineFrame.scripts.OnEvent, lootLineFrame, "CHAT_MSG_LOOT", nil)
check("a missing message does not raise", okNil)
check("...it is counted as unreadable", GuildToolsLootTestDB.lootLineStats.unreadable == 1)

GuildToolsLootTestDB.lootLines = {}
GuildToolsLootTestDB.lootLineStats = { seen = 0, secret = 0, unreadable = 0 }
out = say("GUILDTOOLSLOOTTEST", "lootlines")
check("with no lines it explains personal loot", out:find("none yet") and out:find("personal loot"), out:sub(1, 300))

-- debug: personal loot is called out as the reason nothing can be captured
zone(true, "raid", "Some Old Raid", 14)
C_PartyInfo = { GetLootMethod = function() return 5 end }
LoggingCombat = function() return true end
out = say("GUILDTOOLSLOOTTEST", "debug")
check("debug names the zone and difficulty", out:find("Some Old Raid") and out:find("Normal"), out:sub(1, 300))
check("debug flags PERSONAL LOOT and says why nothing is captured", out:find("Personal loot") and out:find("PERSONAL LOOT") and out:find("no Need wins"), out:sub(1, 400))
check("debug reports chat and combat logging", out:find("chat logging: ON") and out:find("combat logging: ON"), out:sub(1, 400))
check("debug is saved for the file", type(GuildToolsLootTestDB.debug) == "table" and GuildToolsLootTestDB.debug.personalLoot == true and GuildToolsLootTestDB.debug.zone == "Some Old Raid")

C_PartyInfo = { GetLootMethod = function() return 3 end }
out = say("GUILDTOOLSLOOTTEST", "debug")
check("group loot is NOT flagged as personal", out:find("Group loot") and not out:find("PERSONAL LOOT"), out:sub(1, 300))
C_PartyInfo = nil
GetLootMethod = function() return "personalloot" end
out = say("GUILDTOOLSLOOTTEST", "debug")
check("the legacy loot API is understood too", out:find("PERSONAL LOOT"), out:sub(1, 300))
GetLootMethod = nil
out = say("GUILDTOOLSLOOTTEST", "debug")
check("with no loot API at all it says unknown rather than erroring", out:find("loot method: unknown") and out:find("lootlines"), out:sub(1, 300))
LoggingCombat = nil
out = say("GUILDTOOLSLOOTTEST", "debug")
check("...and missing logging APIs read 'unavailable'", out:find("combat logging: unavailable"), out:sub(1, 300))

out = say("GUILDTOOLSLOOTTEST", "help")
check("help lists debug and lootlines", out:find("debug") and out:find("lootlines"), "")

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
