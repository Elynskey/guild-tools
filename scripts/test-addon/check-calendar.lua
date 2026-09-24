-- The TEST addon's calendar reader in a mocked WoW client: which events it reads, who is coming,
-- skipping holidays, crossing into next month, and an event the game never opens.
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

-- Mocked calendar: today is 2026-09-28; September has 30 days.
C_DateAndTime = { GetCurrentCalendarTime = function() return { year = 2026, month = 9, monthDay = 28, hour = 12, minute = 0 } end }
local INV = function(name, className, status) return { name = name, className = className, level = 90, inviteStatus = status } end
local calendar = {
  [0] = {
    [29] = {
      { title = "M+ Night", calendarType = "GUILD_EVENT", startTime = { year = 2026, month = 9, monthDay = 29, hour = 20, minute = 30 }, answers = true,
        invites = { INV("Narima", "Death Knight", 1), INV("Jesmarie", "Priest", 6), INV("Odasa-ArgentDawn", "Shaman", 8), INV("Silverhorn", "Paladin", 2) } },
      { title = "Darkmoon Faire", calendarType = "HOLIDAY", startTime = { year = 2026, month = 9, monthDay = 29, hour = 0, minute = 0 } },
    },
  },
  [1] = {
    [3] = { { title = "Raid", calendarType = "GUILD_EVENT", startTime = { year = 2026, month = 10, monthDay = 3, hour = 19, minute = 0 }, answers = false, invites = {} } },
    [20] = { { title = "Too far out", calendarType = "GUILD_EVENT", startTime = { year = 2026, month = 10, monthDay = 20, hour = 19, minute = 0 }, answers = true, invites = {} } },
  },
}
local open = nil
local function fire(event)
  for _, f in ipairs(frames) do
    if f.events[event] and f.scripts.OnEvent then f.scripts.OnEvent(f, event) end
  end
end
C_Calendar = {
  OpenCalendar = function() end,
  SetAbsMonth = function() end,
  GetMonthInfo = function(offset) return { numDays = offset == 0 and 30 or 31 } end,
  GetNumDayEvents = function(offset, day) return #((calendar[offset] or {})[day] or {}) end,
  GetDayEvent = function(offset, day, i) return calendar[offset][day][i] end,
  OpenEvent = function(offset, day, i)
    open = calendar[offset][day][i]
    if open.answers then fire("CALENDAR_OPEN_EVENT") end
  end,
  GetEventInfo = function() return open and { title = open.title } end,
  GetNumInvites = function() return open and #open.invites or 0 end,
  EventGetInvite = function(i) return open.invites[i] end,
  CloseEvent = function() open = nil end,
}

local ok, err = pcall(dofile, "addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")
assert(ok, "load error: " .. tostring(err))

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end

printed = {}
SlashCmdList["GUILDTOOLSLOOTTEST"]("calendar")
local said = table.concat(printed, " || ")
local cal = GuildToolsLootTestDB.calendar
check("the scan saves a calendar", cal ~= nil and type(cal.events) == "table")
local events = cal and cal.events or {}
check("reads the two guild events in the next 14 days, skips the holiday and the one 22 days out", #events == 2, tostring(#events) .. " event(s)")
local mplus, raid = events[1] or {}, events[2] or {}
check("event time is realm time as YYYY-MM-DDTHH:MM", mplus.start == "2026-09-29T20:30", tostring(mplus.start))
check("reads every invitee with a readable status", mplus.invites and #mplus.invites == 4 and mplus.invites[1].status == "available" and mplus.invites[2].status == "signedup" and mplus.invites[3].status == "tentative" and mplus.invites[4].status == "declined")
check("keeps the realm on a cross-realm name for the app to handle", mplus.invites and mplus.invites[3].name == "Odasa-ArgentDawn")
check("crosses into next month (offset 1) for early-October events", raid.start == "2026-10-03T19:00", tostring(raid.start))
check("an event the game never opens is saved without a list, and says why", raid.invites == nil and type(raid.note) == "string", tostring(raid.note))
check("the command says how many are coming", said:find("3 coming of 4 invited", 1, true) ~= nil, said:sub(1, 300))

-- An event the player opens themselves mid-scan doesn't get its invites filed under ours.
calendar[0][29][1].answers = false
local realOpen = C_Calendar.OpenEvent
C_Calendar.OpenEvent = function(offset, day, i)
  open = { title = "Someone else's event", invites = { INV("Stranger", "Rogue", 1) } }
  fire("CALENDAR_OPEN_EVENT")
end
SlashCmdList["GUILDTOOLSLOOTTEST"]("calendar")
local first = GuildToolsLootTestDB.calendar.events[1]
check("ignores a different event opened meanwhile", first and first.invites == nil, first and tostring(first.note))
C_Calendar.OpenEvent = realOpen

print(string.format("%d/%d checks passed", checks - failed, checks))
os.exit(failed == 0 and 0 or 1)
