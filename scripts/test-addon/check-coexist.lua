-- Loads the REAL addon and the generated TEST addon into one mocked WoW client and checks they coexist.
local printed = {}
local function noop() end
local anyobj
anyobj = setmetatable({}, { __index = function() return function() return anyobj end end, __call = function() return anyobj end })
function CreateFrame() return anyobj end
UIParent = anyobj
DEFAULT_CHAT_FRAME = { AddMessage = function(_, m) printed[#printed + 1] = m end }
StaticPopupDialogs = {}
StaticPopup_Show = noop
GetTime = function() return 0 end
date = os.date
time = os.time
UnitName = function() return "Tester" end
GetUnitName = function() return "Tester-ArgentDawn" end
GetRealmName = function() return "Argent Dawn" end
IsInRaid = function() return true end
IsInGroup = function() return true end
C_Timer = { After = function(_, fn) fn() end }

local state = false
local logged = {}
C_ChatInfo = {
  IsLoggingChat = function() return state end,
  RegisterAddonMessagePrefix = function(p) logged[#logged + 1] = "register " .. p end,
  SendAddonMessageLogged = function(prefix, text, chatType, target)
    logged[#logged + 1] = string.format("%s|%s|%s|%s", prefix, text, chatType, tostring(target))
  end,
}
LoggingChat = function(on) state = on end
SlashCmdList = {}
GuildToolsLootDB = nil
GuildToolsLootTestDB = nil

local function load(path)
  local ok, err = pcall(dofile, path)
  assert(ok, "load error in " .. path .. ": " .. tostring(err))
end
load("addon/GuildToolsLoot/GuildToolsLoot.lua")
load("addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end

check("both slash handlers exist, under different keys", SlashCmdList["GUILDTOOLSLOOT"] and SlashCmdList["GUILDTOOLSLOOTTEST"] and SlashCmdList["GUILDTOOLSLOOT"] ~= SlashCmdList["GUILDTOOLSLOOTTEST"])
check("real command is still /gtloot", SLASH_GUILDTOOLSLOOT1 == "/gtloot")
check("test command is /gtloottest", SLASH_GUILDTOOLSLOOTTEST1 == "/gtloottest")
check("separate saved-variable tables", GuildToolsLootDB ~= nil and GuildToolsLootTestDB ~= nil and GuildToolsLootDB ~= GuildToolsLootTestDB)
check("separate popup dialogs (real and test)", StaticPopupDialogs["GUILDTOOLSLOOT_CONFIRM"] ~= nil and StaticPopupDialogs["GUILDTOOLSLOOTTEST_CONFIRM"] ~= nil and StaticPopupDialogs["GUILDTOOLSLOOT_STATUS"] ~= StaticPopupDialogs["GUILDTOOLSLOOTTEST_STATUS"])

local function say(cmd, msg)
  printed = {}
  SlashCmdList[cmd](msg)
  return table.concat(printed, " || ")
end

-- the copied commands, under the test name
local out = say("GUILDTOOLSLOOTTEST", "off")
check("/gtloottest off works and is labelled TEST", out:find("TEST") and GuildToolsLootTestDB.enabled == false, out)
check("...and did NOT touch the real addon's setting", GuildToolsLootDB.enabled ~= false)
out = say("GUILDTOOLSLOOTTEST", "on")
check("/gtloottest on works", GuildToolsLootTestDB.enabled == true, out)
state = false
out = say("GUILDTOOLSLOOTTEST", "chatlog")
check("/gtloottest chatlog ends with chat logging ON", state == true, out)
check("messages tell you to use /gtloottest, not /gtloot", not out:find("/gtloot[^t]"), out)

-- the experiment
logged = {}
out = say("GUILDTOOLSLOOTTEST", "logmark")
check("/gtloottest logmark sends a logged marker to yourself and to the raid", #logged >= 3 and logged[2]:find("GTLTEST|probe%-") and logged[2]:find("WHISPER|Tester%-ArgentDawn") and logged[3]:find("|RAID|"), table.concat(logged, " ; "))
check("...and tells you what to search for", out:find("probe%-") and out:find("WoWChatLog"), out)
check("...and records the probe in the TEST saved variables only", GuildToolsLootTestDB.probes and #GuildToolsLootTestDB.probes == 1 and GuildToolsLootDB.probes == nil)

-- when the API is missing it must say so, not error
local saved = C_ChatInfo.SendAddonMessageLogged
C_ChatInfo.SendAddonMessageLogged = nil
out = say("GUILDTOOLSLOOTTEST", "logmark")
check("logmark degrades politely without SendAddonMessageLogged", out:find("not available"), out)
C_ChatInfo.SendAddonMessageLogged = saved

-- an API that errors must not crash the command
C_ChatInfo.SendAddonMessageLogged = function() error("blocked by the client") end
out = say("GUILDTOOLSLOOTTEST", "logmark")
check("logmark survives an erroring API and reports the error", out:find("error"), out)
C_ChatInfo.SendAddonMessageLogged = saved

out = say("GUILDTOOLSLOOTTEST", "help")
check("/gtloottest help lists the test commands", out:find("logmark") and out:find("chatlog"), out)

-- the real addon is untouched by all of the above
out = say("GUILDTOOLSLOOT", "logmark")
check("the REAL /gtloot has no logmark (test-only)", not out:find("probe"), out)

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
