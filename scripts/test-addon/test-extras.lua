-- Test-only additions, appended by scripts/make-test-addon.mjs to the generated GuildToolsLootTest
-- addon (never part of the real GuildToolsLoot addon or the app installer). Everything here is
-- an experiment to run on a real client; each command says plainly what it did and what it saw.
--
--   /gtloottest logmark   send a "logged" addon message and tell you what to look for in
--                         WoWChatLog.txt -- the experiment for proving chat logging is
--                         really writing from inside the game
--   /gtloottest help      list every test command
--
-- This block runs after the whole copied addon, so it can use the file-level locals declared
-- above it (announce, isChatLoggingAPI, ...) and wraps the copied slash handler.

local TEST_PREFIX = "GTLTEST"

local function testSelfName()
  -- The full Name-Realm form: addon whispers to yourself need it on some clients.
  if GetUnitName then return GetUnitName("player", true) end
  return UnitName("player")
end

local function groupChannel()
  if IsInGroup and LE_PARTY_CATEGORY_INSTANCE and IsInGroup(LE_PARTY_CATEGORY_INSTANCE) then return "INSTANCE_CHAT" end
  if IsInRaid and IsInRaid() then return "RAID" end
  if IsInGroup and IsInGroup() then return "PARTY" end
  return nil
end

local function logMark()
  if not (C_ChatInfo and C_ChatInfo.SendAddonMessageLogged) then
    announce("SendAddonMessageLogged is not available on this client, so a marker can't be written.")
    return
  end
  if C_ChatInfo.RegisterAddonMessagePrefix then C_ChatInfo.RegisterAddonMessagePrefix(TEST_PREFIX) end

  local nonce = "probe-" .. date("%H%M%S")
  local results = {}

  local okSelf, errSelf = pcall(C_ChatInfo.SendAddonMessageLogged, TEST_PREFIX, nonce .. "-self", "WHISPER", testSelfName())
  results[#results + 1] = "to yourself: " .. (okSelf and "sent" or ("error " .. tostring(errSelf)))

  local channel = groupChannel()
  if channel then
    local okGroup, errGroup = pcall(C_ChatInfo.SendAddonMessageLogged, TEST_PREFIX, nonce .. "-" .. channel:lower(), channel)
    results[#results + 1] = "to " .. channel .. ": " .. (okGroup and "sent" or ("error " .. tostring(errGroup)))
  else
    results[#results + 1] = "not in a group, so no group marker"
  end

  GuildToolsLootTestDB.probes = GuildToolsLootTestDB.probes or {}
  GuildToolsLootTestDB.probes[#GuildToolsLootTestDB.probes + 1] = { at = time(), nonce = nonce, chatLogging = isChatLoggingAPI() and C_ChatInfo.IsLoggingChat() or nil }

  announce("marker " .. nonce .. " -- " .. table.concat(results, "; "))
  announce("chat logging reads " .. (isChatLoggingAPI() and (C_ChatInfo.IsLoggingChat() and "ON" or "OFF") or "unavailable") .. ". Now open Logs\\WoWChatLog.txt and search for  " .. nonce .. "  -- tell us whether it is there, and what the line looks like.")
end

local function testHelp()
  announce("test commands: /gtloottest on | off | scan | chatlog (same as the real addon's /gtloot) plus")
  announce("  /gtloottest logmark -- write a marker line and look for it in WoWChatLog.txt (does the game's ON really write?)")
  announce("  /gtloottest help -- this list")
  announce("This test addon keeps its own data (GuildToolsLootTestDB) and never reaches the Guild Tools app.")
end

local copiedHandler = SlashCmdList["GUILDTOOLSLOOTTEST"]
SlashCmdList["GUILDTOOLSLOOTTEST"] = function(msg)
  local arg = (msg or ""):lower():match("^%s*(%S*)")
  if arg == "logmark" then
    if not GuildToolsLootTestDB then GuildToolsLootTestDB = {} end
    logMark()
  elseif arg == "help" then
    testHelp()
  else
    copiedHandler(msg)
  end
end

-- Say so once per login, in a colour the real addon never uses, so it can't be mistaken for it.
do
  local banner = CreateFrame("Frame")
  banner:RegisterEvent("PLAYER_LOGIN")
  banner:SetScript("OnEvent", function()
    announce("TEST addon loaded -- type /gtloottest help. The real /gtloot addon is unaffected.")
  end)
end
