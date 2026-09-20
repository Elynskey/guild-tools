-- Test-only additions, appended by scripts/make-test-addon.mjs to the generated GuildToolsLootTest
-- addon (never part of the real GuildToolsLoot addon or the app installer). Everything here is
-- for trying things on a real client; each command says plainly what it did and what it saw.
--
--   /gtloottest track [all|strict]   what is tracked (all content by default; strict = the real addon's rules)
--   /gtloottest last [n]             the last n Need wins this addon captured, and where each came from
--   /gtloottest selftest             push a fake Need win through the real capture code and say PASS/FAIL
--   /gtloottest logmark              write a marker line and check the game really writes the chat log
--   /gtloottest help                 list every test command
--
-- This block runs after the whole copied addon, so it can use the file-level locals declared above
-- it (announce, frame, isChatLoggingAPI, testTrackAll, ...) and wraps the copied slash handler.

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

-- Where a record came from, in words: "Ula'tek (Heroic Raid)" / "Some Dungeon (Mythic Dungeon)".
local function describeOrigin(r)
  local where = r.zone and r.zone ~= "" and r.zone or "no instance"
  local kind = r.contentType and r.contentType ~= "none" and r.contentType or "open world"
  local diff = r.difficulty and (" " .. r.difficulty) or ""
  return where .. " (" .. kind .. diff .. ")" .. (r.boss and (", boss: " .. r.boss) or "")
end

local function showLast(arg)
  local n = tonumber(arg) or 5
  local wins = GuildToolsLootTestDB.records or {}
  local losses = GuildToolsLootTestDB.needLosses or {}
  announce(#wins .. " Need win(s) and " .. #losses .. " lost Need roll(s) captured by this test addon so far. Tracking: " .. (testTrackAll() and "ALL content" or "STRICT (real addon's rules)") .. ".")
  if #wins == 0 then
    announce("nothing captured yet -- roll Need on something in a group, or run /gtloottest selftest to check the capture code itself.")
    return
  end
  for i = #wins, math.max(1, #wins - n + 1), -1 do
    local r = wins[i]
    announce(date("%H:%M:%S", r.time) .. "  " .. tostring(r.winner) .. " won " .. tostring(r.itemLink) .. "  --  " .. describeOrigin(r))
  end
end

-- Pushes a fake Need win through the REAL capture path (the same CHAT_MSG_LOOT handler a real
-- roll goes through), so "does the addon record a win here?" can be answered without waiting for
-- a drop. It checks the addon's own logic and the current zone; it cannot check that the game
-- writes the line to WoWChatLog.txt (that needs a real roll, or /gtloottest logmark for the log).
local SELFTEST_LINK = "|cffffffff|Hitem:25::::::::1:::::::|h[Worn Shortsword]|h|r"

local function selfTest()
  local handler = frame and frame.GetScript and frame:GetScript("OnEvent")
  if not handler then
    announce("self-test can't find the addon's event handler on this client.")
    return
  end
  local records = GuildToolsLootTestDB.records
  local before = #records
  local fakeWinner = "SelfTest" .. date("%H%M%S")
  local wasEnabled = GuildToolsLootTestDB.enabled
  GuildToolsLootTestDB.enabled = true
  local ok, err = pcall(handler, frame, "CHAT_MSG_LOOT", "[Loot]: " .. fakeWinner .. " (Need - 42) Won: " .. SELFTEST_LINK)
  GuildToolsLootTestDB.enabled = wasEnabled

  if not ok then
    announce("SELF-TEST FAILED: the capture code raised an error: " .. tostring(err))
    return
  end
  local rec = records[#records]
  if #records == before + 1 and rec and rec.winner == fakeWinner then
    announce("SELF-TEST PASSED: a Need win was captured here -- " .. describeOrigin(rec) .. ".")
    table.remove(records, #records) -- it was fake; leave the real data clean
  else
    local why = {}
    if not wasEnabled then why[#why + 1] = "logging is OFF (/gtloottest on)" end
    if not testTrackAll() then why[#why + 1] = "tracking is STRICT and this isn't this tier's Normal/Heroic raid (/gtloottest track all)" end
    if #why == 0 then why[#why + 1] = "the win was filtered out (see the message pattern / item exclusions in the addon)" end
    announce("SELF-TEST FAILED: nothing was captured. Likely: " .. table.concat(why, "; ") .. ".")
  end
end

local function setTracking(arg)
  if arg == "strict" then
    GuildToolsLootTestDB.trackAll = false
  elseif arg == "all" then
    GuildToolsLootTestDB.trackAll = true
  end
  announce("tracking: " .. (testTrackAll() and "ALL content -- raids of any difficulty, dungeons, delves, anything with a Need roll." or "STRICT -- only this tier's Normal/Heroic raid, like the real addon.") .. "  (/gtloottest track all|strict)")
end

local function testHelp()
  announce("test commands (same names as the real /gtloot, plus more):")
  announce("  /gtloottest on | off | scan | chatlog   -- as the real addon")
  announce("  /gtloottest track [all|strict]          -- tracking is ALL content by default")
  announce("  /gtloottest last [n]                    -- what was captured, and where (zone / dungeon / raid / difficulty)")
  announce("  /gtloottest selftest                    -- fake Need win through the real capture code: PASS/FAIL")
  announce("  /gtloottest logmark                     -- write a marker and check it lands in WoWChatLog.txt")
  announce("This test addon keeps its own data (GuildToolsLootTestDB) and never reaches the Guild Tools app.")
end

local copiedHandler = SlashCmdList["GUILDTOOLSLOOTTEST"]
SlashCmdList["GUILDTOOLSLOOTTEST"] = function(msg)
  local arg, rest = (msg or ""):lower():match("^%s*(%S*)%s*(.-)%s*$")
  if arg == "logmark" then
    logMark()
  elseif arg == "selftest" then
    selfTest()
  elseif arg == "last" then
    showLast(rest)
  elseif arg == "track" then
    setTracking(rest)
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
    announce("TEST addon loaded, tracking " .. (testTrackAll() and "ALL content" or "STRICT") .. " -- type /gtloottest help. The real /gtloot addon is unaffected.")
  end)
end
