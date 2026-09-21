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

-- the game now writes ", Main-Spec" inside the parens (WoW 12.1.0): both addons must still read it
local function winMainSpec(frame, winner)
  n = n + 1
  frame.scripts.OnEvent(frame, "CHAT_MSG_LOOT", "[Loot]: " .. winner .. " (Need - 77, Main-Spec) Won: " .. link(2000 + n))
end
local realRecordsSoFar = GuildToolsLootDB.records
GuildToolsLootDB.records = {}
zone(true, "raid", "The Venomous Abyss", 15)
realFrame.scripts.OnEvent(realFrame, "ENCOUNTER_START", 222, "Raid Boss")
winMainSpec(realFrame, "Zed")
check("REAL addon reads a win with the ', Main-Spec' qualifier", #GuildToolsLootDB.records == 1 and GuildToolsLootDB.records[1].winner == "Zed", tostring(#GuildToolsLootDB.records))
winMainSpec(realFrame, "You")
check("...maps the word 'You' to this character (not a stranger named You)", GuildToolsLootDB.records[2] and GuildToolsLootDB.records[2].winner == "Tester" and GuildToolsLootDB.records[2].self == true, GuildToolsLootDB.records[2] and tostring(GuildToolsLootDB.records[2].winner))
local before = #GuildToolsLootDB.records
realFrame.scripts.OnEvent(realFrame, "CHAT_MSG_LOOT", "[Loot]: Tester (Need - 12, Off-Spec) Won: " .. link(2000 + n))
check("...so a second path reporting the same win under the real name does not record it twice", #GuildToolsLootDB.records == before, tostring(#GuildToolsLootDB.records))
-- the game's CURRENT wording (live 2026-09-20, WoW 12.1.0): "Loot" is a hyperlink and the item link opens with a named colour
local RAW_YOU = "|HlootHistory:3470|h[Loot]|h: You (Need - 51, Main-Spec) Won: |cnIQ4:|Hitem:270930::::::::90:577::4:3:6652:13332:12825::::::|h[Tomb-Creeper's Claw]|h|r"
local RAW_OTHER = "|HlootHistory:3470|h[Loot]|h: Meteos (Need - 89, Main-Spec) Won: |cnIQ4:|Hitem:268203::::::::90:577::4:3:6652:13332:12825::::::|h[Hexing Spiritrender]|h|r"
local RAW_GREED = "|HlootHistory:3470|h[Loot]|h: Odasa (Greed - 12) Won: |cnIQ2:|Hitem:268204::::::::90:577::4:3:6652:13332:12825::::::|h[Some Cloak]|h|r"
GuildToolsLootDB.records = {}
zone(true, "raid", "The Venomous Abyss", 15)
realFrame.scripts.OnEvent(realFrame, "ENCOUNTER_START", 222, "Raid Boss")
realFrame.scripts.OnEvent(realFrame, "CHAT_MSG_LOOT", RAW_OTHER)
check("REAL addon reads a win in the game's CURRENT wording (hyperlinked [Loot], named-colour item link)", #GuildToolsLootDB.records == 1 and GuildToolsLootDB.records[1].winner == "Meteos" and GuildToolsLootDB.records[1].itemId == 268203, tostring(#GuildToolsLootDB.records))
check("...and records which encounter it came from (from the hyperlink's ID), so officers' copies of one win merge", GuildToolsLootDB.records[1].encounterId == 3470, tostring(GuildToolsLootDB.records[1].encounterId))
check("...and keeps the real item link (for the icon and slot)", GuildToolsLootDB.records[1].itemLink:find("Hitem:268203", 1, true) ~= nil, tostring(GuildToolsLootDB.records[1].itemLink))
realFrame.scripts.OnEvent(realFrame, "CHAT_MSG_LOOT", RAW_YOU)
check("...maps 'You' to this character in the current wording too", GuildToolsLootDB.records[2] and GuildToolsLootDB.records[2].winner == "Tester" and GuildToolsLootDB.records[2].self == true, GuildToolsLootDB.records[2] and tostring(GuildToolsLootDB.records[2].winner))
realFrame.scripts.OnEvent(realFrame, "CHAT_MSG_LOOT", RAW_GREED)
check("...and a Greed win is still ignored", #GuildToolsLootDB.records == 2, tostring(#GuildToolsLootDB.records))
issecretvalue = function(v) return v == "SECRET" end
local okSecret = pcall(realFrame.scripts.OnEvent, realFrame, "CHAT_MSG_LOOT", "SECRET")
issecretvalue = nil
check("...and a protected (secret) chat message is skipped instead of raising", okSecret and #GuildToolsLootDB.records == 2)
GuildToolsLootDB.records = realRecordsSoFar

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
local function hasItem(o, id) return o:find("%] " .. id .. " %-%-") end

out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("the text checklist lists only what is still to be tested (10 items)", select(2, out:gsub("%[[ x!]%]", "")) == 10, out:sub(1, 200))
check("...nothing starts ticked", not out:find("%[x%]") and not out:find("%[!%]"), out:sub(1, 120))
local gone = { "loaded", "chatlog", "tracking", "selftest", "marker", "win", "loss", "raid", "live_app", "reload", "discord", "verify" }
local stillThere = {}
for _, id in ipairs(gone) do if hasItem(out, id) then stillThere[#stillThere + 1] = id end end
check("...and everything already proven working is gone", #stillThere == 0, table.concat(stillThere, ","))
local wanted = { "flush", "syncbtn", "syncclick", "app_sync", "once", "chatpath", "selfwin", "dungeon", "delve", "legacy" }
local missingItems = {}
for _, id in ipairs(wanted) do if not hasItem(out, id) then missingItems[#missingItems + 1] = id end end
check("...and what is left to do is there", #missingItems == 0, table.concat(missingItems, ","))

-- a real win in a dungeon, seen by the poll
win(testFrame, "Foxtrot")
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a real win in a dungeon ticks DUNGEON only", out:find("%[x%] dungeon") and out:find("%[ %] delve"), "")

-- a lost roll in a delve
GuildToolsLootTestDB.needLosses[#GuildToolsLootTestDB.needLosses + 1] = { itemId = 9, name = "Hotel", time = time(), contentType = "scenario", zone = "A Delve" }
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a lost roll in a delve ticks DELVE", out:find("%[x%] delve"), "")

-- your own win: once, under your name
zone(true, "raid", "Some Old Raid", 16)
win(testFrame, "Tester")
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("your own win, recorded once under your name, ticks 'selfwin'", out:find("%[x%] selfwin"), "")
local mine = GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records]
local copy = {}
for k, v in pairs(mine) do copy[k] = v end
GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records + 1] = copy
say("GUILDTOOLSLOOTTEST", "checklist refresh")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("...and a second copy of the same win turns it FAILED", out:find("%[!%] selfwin"), "")
GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records] = nil
GuildToolsLootTestDB.checklist.selfwin = nil

-- manual items
out = say("GUILDTOOLSLOOTTEST", "check once")
check("check once: first click = done", out:find("done") and GuildToolsLootTestDB.checklist.once == "pass", out)
out = say("GUILDTOOLSLOOTTEST", "check once")
check("...second = FAILED", out:find("FAILED") and GuildToolsLootTestDB.checklist.once == "fail", out)
out = say("GUILDTOOLSLOOTTEST", "check once")
check("...third = cleared", out:find("cleared") and GuildToolsLootTestDB.checklist.once == nil, out)
out = say("GUILDTOOLSLOOTTEST", "check flush")
check("an auto item can't be ticked by hand", out:find("ticks itself"), out)
out = say("GUILDTOOLSLOOTTEST", "check nonsense")
check("an unknown id lists the manual ones", out:find("app_sync, once, legacy"), out)

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
check("checklist state is kept in the test addon's saved variables", type(GuildToolsLootTestDB.checklist) == "table" and GuildToolsLootTestDB.checklist.dungeon == "pass")
say("GUILDTOOLSLOOTTEST", "checklist reset")
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("reset clears the ticks (dungeon is unticked again)", out:find("%[ %] dungeon"), "")

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
check("help mentions the checklist and the manual items", out:find("checklist") and out:find("app_sync"), "")

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
out = say("GUILDTOOLSLOOTTEST", "checklist text")
check("a line the chat-text pattern matches ticks 'chatpath' on the checklist", out:find("%[x%] chatpath"), out:sub(1, 200))
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", "|HlootHistory:3470|h[Loot]|h: Meteos (Need - 89, Main-Spec) Won: |cnIQ4:|Hitem:268203::::::::90:577::4:3:6652:13332:12825::::::|h[Hexing Spiritrender]|h|r")
check("the game's CURRENT wording (hyperlinked [Loot]) is recognised as a Need win by the raw-line tagger too", GuildToolsLootTestDB.lootLines[#GuildToolsLootTestDB.lootLines].matches == true)
GuildToolsLootTestDB.lootLines[#GuildToolsLootTestDB.lootLines] = nil
GuildToolsLootTestDB.lootLineStats.seen = GuildToolsLootTestDB.lootLineStats.seen - 1
lootLineFrame.scripts.OnEvent(lootLineFrame, "CHAT_MSG_LOOT", "[Loot]: Mooingshots (Need - 75, Main-Spec) Won: " .. link(4004))
check("the game's newer ', Main-Spec' wording is recognised as a Need win", GuildToolsLootTestDB.lootLines[#GuildToolsLootTestDB.lootLines].matches == true)
GuildToolsLootTestDB.lootLines[#GuildToolsLootTestDB.lootLines] = nil
GuildToolsLootTestDB.lootLineStats.seen = GuildToolsLootTestDB.lootLineStats.seen - 1
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
state = true -- chat logging reads ON in this scenario
out = say("GUILDTOOLSLOOTTEST", "debug")
check("debug names the zone and difficulty", out:find("Some Old Raid") and out:find("Normal"), out:sub(1, 300))
check("debug reports PERSONAL LOOT but says it is not proof that nobody rolls, and what to trust instead", out:find("Personal loot") and out:find("reads PERSONAL LOOT") and out:find("NOT a reliable sign") and out:find("lootlines"), out:sub(1, 500))
check("debug shows the raw answers of both loot APIs", out:find("C_PartyInfo.GetLootMethod = 5") and out:find("GetLootMethod = nil"), out:sub(1, 400))
check("...and saves them", GuildToolsLootTestDB.debug.lootMethodDetail:find("= 5"), tostring(GuildToolsLootTestDB.debug.lootMethodDetail))
check("debug reports chat and combat logging", out:find("chat logging: ON") and out:find("combat logging: ON"), out:sub(1, 400))
check("debug is saved for the file", type(GuildToolsLootTestDB.debug) == "table" and GuildToolsLootTestDB.debug.personalLoot == true and GuildToolsLootTestDB.debug.zone == "Some Old Raid")

-- alone in the raid: personal loot is the game's default, and the message must say that instead of blaming loot rolls
local realIsInGroup = IsInGroup
IsInGroup = function() return false end
out = say("GUILDTOOLSLOOTTEST", "debug")
check("solo: personal loot is explained as the game's default when alone", out:find("not in a group") and out:find("default when alone"), out:sub(1, 400))
IsInGroup = realIsInGroup
zone(true, "raid", "The Venomous Abyss", 17)
out = say("GUILDTOOLSLOOTTEST", "debug")
check("Raid Finder is NOT declared to be rollless (it rolls Need in 12.1.0)", out:find("Raid Finder read this way while the raid was rolling") and not out:find("always hands out"), out:sub(1, 400))
zone(true, "raid", "Some Old Raid", 14)

C_PartyInfo = { GetLootMethod = function() return 3 end }
out = say("GUILDTOOLSLOOTTEST", "debug")
check("group loot is NOT flagged as personal", out:find("Group loot") and not out:find("PERSONAL LOOT"), out:sub(1, 300))
check("...and both raw answers are still shown", out:find("C_PartyInfo.GetLootMethod = 3"), out:sub(1, 300))
C_PartyInfo = nil
GetLootMethod = function() return "personalloot" end
out = say("GUILDTOOLSLOOTTEST", "debug")
check("the legacy loot API is understood too, and shown as the source", out:find("PERSONAL LOOT") and out:find("GetLootMethod = personalloot"), out:sub(1, 300))
GetLootMethod = nil
out = say("GUILDTOOLSLOOTTEST", "debug")
check("with no loot API at all it says unknown rather than erroring", out:find("loot method: unknown") and out:find("lootlines"), out:sub(1, 300))
LoggingCombat = nil
out = say("GUILDTOOLSLOOTTEST", "debug")
check("...and missing logging APIs read 'unavailable'", out:find("combat logging: unavailable"), out:sub(1, 300))

out = say("GUILDTOOLSLOOTTEST", "help")
check("help lists debug and lootlines", out:find("debug") and out:find("lootlines"), "")

-- =========================== the game's chat logging reading is saved for Guild Tools ===========================
local realApiReading = C_ChatInfo.IsLoggingChat
GuildToolsLootDB.chatLogging = nil
state = true
realFrame.scripts.OnEvent(realFrame, "PLAYER_LOGOUT")
check("the REAL addon saves the game's chat logging reading at PLAYER_LOGOUT (ON)", GuildToolsLootDB.chatLogging ~= nil and GuildToolsLootDB.chatLogging.on == true and type(GuildToolsLootDB.chatLogging.at) == "number", tostring(GuildToolsLootDB.chatLogging))
state = false
realFrame.scripts.OnEvent(realFrame, "PLAYER_LOGOUT")
check("...and OFF, so the app can tell off from 'on but WoW has not written the file'", GuildToolsLootDB.chatLogging.on == false)
state = false
realFrame.scripts.OnEvent(realFrame, "PLAYER_LOGIN")
check("at login the reading is taken AFTER the automatic re-enable, so it is not a false OFF", GuildToolsLootDB.chatLogging.on == true, tostring(GuildToolsLootDB.chatLogging.on))
GuildToolsLootDB.chatLogging = { on = true, at = 1 }
C_ChatInfo.IsLoggingChat = nil
local okNoApi = pcall(realFrame.scripts.OnEvent, realFrame, "PLAYER_LOGOUT")
check("on a client that can't report chat logging it saves nothing and does not raise", okNoApi and GuildToolsLootDB.chatLogging.at == 1)
C_ChatInfo.IsLoggingChat = realApiReading
state = true

-- =========================== one-click sync ===========================
local clock = 0
GetTime = function() return clock end
local reloads = 0
ReloadUI = function() reloads = reloads + 1 end
local encounter, combat = false, false
IsEncounterInProgress = function() return encounter end
InCombatLockdown = function() return combat end
local loginFrame, ticker
for i = #frames, 1, -1 do
  local f = frames[i]
  if not loginFrame and f.events.PLAYER_LOGIN and f ~= testFrame and f ~= realFrame then loginFrame = f end
  if not ticker and f.scripts.OnUpdate then ticker = f end
end
check("the addon has a login hook and a 2-second ticker to drive the sync button", loginFrame ~= nil and ticker ~= nil)
local function tick() ticker.scripts.OnUpdate(ticker, 2) end
local function syncButton()
  for i = #frames, 1, -1 do if frames[i].scripts.OnClick and frames[i].scripts.OnEnter and frames[i].scripts.OnDragStart and frames[i].scripts.OnDragStop and frames[i].scripts.OnLeave and not rawget(frames[i], "close") then return frames[i] end end
end
local function buttonShown() local b = syncButton(); return b ~= nil and b.shown == true end

GuildToolsLootTestDB.records = {}
GuildToolsLootTestDB.needLosses = {}
GuildToolsLootTestDB.trades = {}
GuildToolsLootTestDB.syncPromptOff = nil
clock = 0
loginFrame.scripts.OnEvent(loginFrame, "PLAYER_LOGIN")
tick()
check("no button while nothing new has been captured", not buttonShown())

GuildToolsLootTestDB.records[#GuildToolsLootTestDB.records + 1] = { itemId = 1, winner = "Tester", time = time() }
tick()
check("a fresh capture does not show the button yet (waits for things to go quiet)", not buttonShown())
printed = {}
tick()
check("no chat message while it is still busy (the batch is not ready)", not table.concat(printed, " "):find("Loot logged"))
clock = 16
printed = {}
tick()
check("after 15 quiet seconds the click-to-sync button appears", buttonShown())
check("...and says so in chat: 'Loot logged: 1 Need win(s)... click to sync'", table.concat(printed, " "):find("Loot logged: 1 Need win%(s%)") and table.concat(printed, " "):find("Click the sync button"), table.concat(printed, " "):sub(1, 200))
printed = {}
tick()
tick()
check("...once per batch, not on every tick", not table.concat(printed, " "):find("Loot logged"), table.concat(printed, " "):sub(1, 120))
check("...and ticks 'syncbtn' on the checklist", GuildToolsLootTestDB.checklist.syncbtn == "pass")

combat = true
tick()
check("...but never in combat", not buttonShown())
combat = false
encounter = true
tick()
check("...nor during an encounter", not buttonShown())
encounter = false
tick()
check("...and returns once it is safe", buttonShown())

syncButton().scripts.OnClick(syncButton())
check("clicking remembers what was synced, for the message after the reload", GuildToolsLootTestDB.syncNote ~= nil and GuildToolsLootTestDB.syncNote.wins == 1 and GuildToolsLootTestDB.syncNote.losses == 0)
check("clicking the button reloads the UI (a real click is the hardware event ReloadUI needs)", reloads == 1, tostring(reloads))
check("...and ticks 'syncclick' BEFORE the reload writes the table to disk", GuildToolsLootTestDB.checklist.syncclick == "pass")
out = say("GUILDTOOLSLOOTTEST", "sync")
check("/gtloottest sync reloads too and says so", reloads == 2 and out:find("reloading the UI"), out)

local realReload = ReloadUI
ReloadUI = function() error("ADDON_ACTION_FORBIDDEN") end
out = say("GUILDTOOLSLOOTTEST", "sync")
check("if the game refuses the reload it says so and points at /reload instead of raising", out:find("would not reload") and out:find("/reload"), out)
check("...and marks 'syncclick' FAILED so it is not mistaken for working", GuildToolsLootTestDB.checklist.syncclick == "fail")
check("...and does not leave a note that would claim a sync that never happened", GuildToolsLootTestDB.syncNote == nil)
GuildToolsLootTestDB.syncNote = { wins = 1, losses = 12, trades = 0, at = time() }
ReloadUI = realReload

printed = {}
loginFrame.scripts.OnEvent(loginFrame, "PLAYER_LOGIN")
local afterReload = table.concat(printed, " ")
tick()
check("after the reload (a new PLAYER_LOGIN) nothing is pending, so the button goes away", not buttonShown())
check("...and chat confirms: 'Loot logged and saved: 1 Need win(s) and 12 lost roll(s)'", afterReload:find("Loot logged and saved: 1 Need win%(s%) and 12 lost roll%(s%)") and afterReload:find("picks it up within a few seconds"), afterReload:sub(1, 240))
check("...and the note is cleared so it is only said once", GuildToolsLootTestDB.syncNote == nil)
GuildToolsLootTestDB.syncNote = { wins = 3, losses = 0, trades = 0, at = time() - 3600 }
printed = {}
loginFrame.scripts.OnEvent(loginFrame, "PLAYER_LOGIN")
check("a stale note (an hour old) is not announced", not table.concat(printed, " "):find("Loot logged and saved"))

GuildToolsLootTestDB.needLosses[#GuildToolsLootTestDB.needLosses + 1] = { itemId = 2, name = "Someone", time = time() }
tick()
clock = 40
tick()
check("a lost roll counts as loot to sync too", buttonShown())
out = say("GUILDTOOLSLOOTTEST", "syncoff")
check("/gtloottest syncoff hides it and says how to get it back", not buttonShown() and out:find("OFF") and GuildToolsLootTestDB.syncPromptOff == true, out)
tick()
check("...and it stays hidden", not buttonShown())
out = say("GUILDTOOLSLOOTTEST", "syncoff")
tick()
check("...until switched back on", buttonShown() and out:find("ON"), out)
GuildToolsLootTestDB.syncPromptOff = nil

-- =========================== the flush test ===========================
local calls = {}
local chatlogState = state
LoggingChat = function(on) calls[#calls + 1] = "api:" .. tostring(on); state = on end
SlashCmdList["CHATLOG"] = function() calls[#calls + 1] = "slash"; state = not state end
state = true
out = say("GUILDTOOLSLOOTTEST", "flushtest")
check("flushtest announces what is available and runs all four steps", out:find("LoggingChat is available") and out:find("STEP 1") and out:find("STEP 2") and out:find("STEP 3") and out:find("STEP 4"), out:sub(1, 300))
check("...leaves chat logging ON", state == true and out:find("reads ON"), tostring(state))
check("...uses both routes: LoggingChat(false/true) and the /chatlog command", table.concat(calls, ","):find("api:false") and table.concat(calls, ","):find("api:true") and table.concat(calls, ","):find("slash"), table.concat(calls, ","))
local stages = GuildToolsLootTestDB.flushtest and GuildToolsLootTestDB.flushtest.stages or {}
check("...and saves each step with its time so an outside watcher can match them", #stages == 7 and stages[1].name:find("STEP 1") and type(stages[1].at) == "number", tostring(#stages))
check("...and ticks 'flush' on the checklist", GuildToolsLootTestDB.checklist.flush == "pass")

calls = {}
LoggingChat = nil
state = true
out = say("GUILDTOOLSLOOTTEST", "flushtest")
check("without LoggingChat it says so, still tries the /chatlog command, and ends ON", out:find("LoggingChat is NOT available") and table.concat(calls, ","):find("slash") and state == true, out:sub(1, 200) .. " | " .. table.concat(calls, ","))

state = false
out = say("GUILDTOOLSLOOTTEST", "flushtest")
check("if logging was off it turns it on first and still ends ON", state == true, tostring(state))

local realApi = C_ChatInfo.IsLoggingChat
C_ChatInfo.IsLoggingChat = nil
out = say("GUILDTOOLSLOOTTEST", "flushtest")
check("when the game can't report chat logging the test refuses instead of guessing", out:find("can't read chat logging"), out)
C_ChatInfo.IsLoggingChat = realApi
LoggingChat = function(on) state = on end

out = say("GUILDTOOLSLOOTTEST", "help")
check("help lists sync and flushtest", out:find("sync") and out:find("flushtest"), "")

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
