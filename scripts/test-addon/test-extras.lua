-- Test-only additions, appended by scripts/make-test-addon.mjs to the generated GuildToolsLootTest
-- addon (never part of the real GuildToolsLoot addon or the app installer). Everything here is
-- for trying things on a real client; each command says plainly what it did and what it saw.
--
--   /gtloottest track [all|strict]   what is tracked (all content by default; strict = the real addon's rules)
--   /gtloottest last [n]             the last n Need wins this addon captured, and where each came from
--   /gtloottest selftest             push a fake Need win through the real capture code and say PASS/FAIL
--   /gtloottest logmark              write a marker line and check the game really writes the chat log
--   /gtloottest checklist [text|reset]  the in-game test checklist overlay (ticks itself where it can)
--   /gtloottest check <id>           cycle a manual item: unchecked -> done -> failed
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
local testChecklistSet -- assigned in the checklist section below

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
    if testChecklistSet then testChecklistSet("selftest", "fail") end
    return
  end
  local rec = records[#records]
  if #records == before + 1 and rec and rec.winner == fakeWinner then
    announce("SELF-TEST PASSED: a Need win was captured here -- " .. describeOrigin(rec) .. ".")
    table.remove(records, #records) -- it was fake; leave the real data clean
    if testChecklistSet then testChecklistSet("selftest", "pass") end
  else
    local why = {}
    if not wasEnabled then why[#why + 1] = "logging is OFF (/gtloottest on)" end
    if not testTrackAll() then why[#why + 1] = "tracking is STRICT and this isn't this tier's Normal/Heroic raid (/gtloottest track all)" end
    if #why == 0 then why[#why + 1] = "the win was filtered out (see the message pattern / item exclusions in the addon)" end
    announce("SELF-TEST FAILED: nothing was captured. Likely: " .. table.concat(why, "; ") .. ".")
    if testChecklistSet then testChecklistSet("selftest", "fail") end
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

-- ---- checklist overlay ----
-- The in-game checklist overlay for the TEST addon: what needs to be tested, on screen while you play.
--
-- Items the addon can judge tick themselves (green check); the rest you tick by clicking the row (or
-- /gtloottest check <id>): click once = done, twice = failed, three times = cleared. Saved across /reload.
--   auto   - ticks when the addon sees the thing happen
--   live   - reflects right now (e.g. chat logging ON), never saved
--   manual - only you can see it (the Test app, Discord, the log file)

local CHECKS = {
  { id = "loaded", kind = "auto", text = "Test addon loaded", hint = "you're reading this" },
  { id = "chatlog", kind = "live", text = "Chat logging reads ON", hint = "/gtloottest chatlog if not" },
  { id = "tracking", kind = "live", text = "Tracking set to ALL content", hint = "/gtloottest track all" },
  { id = "selftest", kind = "auto", text = "/gtloottest selftest passes", hint = "fake win through the real code" },
  { id = "marker", kind = "manual", text = "logmark's probe word is in WoWChatLog.txt", hint = "/gtloottest logmark, then search the file" },
  { id = "win", kind = "auto", text = "A real Need WIN captured", hint = "roll Need in a group, win something" },
  { id = "loss", kind = "auto", text = "A real LOST Need roll captured", hint = "roll Need and lose" },
  { id = "raid", kind = "auto", text = "  ...captured in a RAID", hint = "any raid, any difficulty" },
  { id = "dungeon", kind = "auto", text = "  ...captured in a DUNGEON", hint = "any dungeon, any level" },
  { id = "delve", kind = "auto", text = "  ...captured in a DELVE / scenario", hint = "only if it rolls" },
  { id = "live_app", kind = "manual", text = "Test app showed the win LIVE (before /reload)", hint = "Loot History, Guild Tools (Test)" },
  { id = "reload", kind = "manual", text = "After /reload: win in the Test app with zone + difficulty", hint = "Loot History" },
  { id = "discord", kind = "manual", text = "The win posted to the CRD-TEST loot channel", hint = "Discord, loot-need-wins" },
  { id = "verify", kind = "manual", text = "Test app: Verify chat logging shows this PC writing", hint = "say a line in chat first" },
}
local CHECK_INDEX = {}
for _, c in ipairs(CHECKS) do CHECK_INDEX[c.id] = c end

local function checklistStates()
  GuildToolsLootTestDB.checklist = GuildToolsLootTestDB.checklist or {}
  return GuildToolsLootTestDB.checklist
end

-- "pass" | "fail" | nil for one item
local function checkState(c)
  if c.id == "chatlog" then
    if not isChatLoggingAPI() then return nil end
    return C_ChatInfo.IsLoggingChat() and "pass" or "fail"
  elseif c.id == "tracking" then
    return testTrackAll() and "pass" or "fail"
  end
  return checklistStates()[c.id]
end

testChecklistSet = function(id, state)
  if not CHECK_INDEX[id] then return false end
  checklistStates()[id] = state
  return true
end

local checklistFrame

local function checklistCounts()
  local done = 0
  for _, c in ipairs(CHECKS) do
    if checkState(c) == "pass" then done = done + 1 end
  end
  return done, #CHECKS
end

local ICON = { pass = "|TInterface\\RaidFrame\\ReadyCheck-Ready:14|t", fail = "|TInterface\\RaidFrame\\ReadyCheck-NotReady:14|t" }
local ICON_NONE = "|TInterface\\RaidFrame\\ReadyCheck-Waiting:14|t"

local function refreshChecklist()
  if not checklistFrame then return end
  local done, total = checklistCounts()
  if checklistFrame.title then checklistFrame.title:SetText("Guild Tools Loot TEST -- checklist  " .. done .. "/" .. total) end
  for i, c in ipairs(CHECKS) do
    local row = checklistFrame.rows and checklistFrame.rows[i]
    if row and row.label then
      local st = checkState(c)
      row.label:SetText((st and ICON[st] or ICON_NONE) .. " " .. c.text .. (c.kind == "manual" and "  |cff8a8a8a(click)|r" or ""))
    end
  end
end

-- The same list as chat lines: the fallback if the overlay can't be built, and what /gtloottest checklist text prints.
local function checklistLines()
  local lines = {}
  for _, c in ipairs(CHECKS) do
    local st = checkState(c)
    local text = c.text:gsub("^%s+", "")
    lines[#lines + 1] = (st == "pass" and "[x] " or st == "fail" and "[!] " or "[ ] ") .. c.id .. " -- " .. text .. "  (" .. c.hint .. ")"
  end
  return lines
end

local function cycleCheck(c)
  if c.kind ~= "manual" then return end
  local states = checklistStates()
  local cur = states[c.id]
  if cur == nil then states[c.id] = "pass" elseif cur == "pass" then states[c.id] = "fail" else states[c.id] = nil end
  refreshChecklist()
end

local function buildChecklistFrame()
  local f = CreateFrame("Frame", "GuildToolsLootTestChecklist", UIParent, "BackdropTemplate")
  f:SetSize(470, 76 + #CHECKS * 20)
  local pos = GuildToolsLootTestDB.checklistPos
  if pos then f:SetPoint(pos.point, UIParent, pos.relPoint, pos.x, pos.y) else f:SetPoint("CENTER", UIParent, "CENTER", 360, 40) end
  f:SetFrameStrata("MEDIUM")
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local point, _, relPoint, x, y = self:GetPoint()
    GuildToolsLootTestDB.checklistPos = { point = point, relPoint = relPoint, x = x, y = y }
  end)
  if f.SetBackdrop then
    f:SetBackdrop({
      bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
      edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
      tile = true, tileSize = 32, edgeSize = 24,
      insets = { left = 6, right = 6, top = 6, bottom = 6 },
    })
  end

  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetTexture("Interface\\AddOns\\GuildToolsLootTest\\crd-logo")
  f.icon:SetSize(34, 34)
  f.icon:SetPoint("TOPLEFT", f, "TOPLEFT", 14, -12)

  f.title = f:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  f.title:SetPoint("TOPLEFT", f.icon, "TOPRIGHT", 8, -2)

  f.sub = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.sub:SetPoint("TOPLEFT", f.title, "BOTTOMLEFT", 0, -2)
  f.sub:SetText("Ticks itself where it can. Click a (click) row: done, failed, cleared.  /gtloottest checklist hides it.")

  f.close = CreateFrame("Button", nil, f, "UIPanelCloseButton")
  f.close:SetPoint("TOPRIGHT", f, "TOPRIGHT", -4, -4)
  f.close:SetScript("OnClick", function()
    GuildToolsLootTestDB.checklistHidden = true
    f:Hide()
  end)

  f.rows = {}
  for i, c in ipairs(CHECKS) do
    local row = CreateFrame("Button", nil, f)
    row:SetSize(440, 18)
    row:SetPoint("TOPLEFT", f, "TOPLEFT", 16, -58 - (i - 1) * 20)
    row.label = row:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    row.label:SetPoint("LEFT", row, "LEFT", 0, 0)
    row:SetScript("OnClick", function() cycleCheck(c) end)
    row:SetScript("OnEnter", function(self)
      if GameTooltip then
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        GameTooltip:SetText((c.text:gsub("^%s+", "")))
        GameTooltip:AddLine(c.hint, 1, 1, 1, true)
        GameTooltip:Show()
      end
    end)
    row:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
    f.rows[i] = row
  end
  return f
end

local function showChecklist()
  if not checklistFrame then
    local ok, result = pcall(buildChecklistFrame)
    if not ok then
      announce("couldn't draw the checklist window (" .. tostring(result) .. ") -- here it is as text:")
      for _, line in ipairs(checklistLines()) do announce(line) end
      return
    end
    checklistFrame = result
  end
  GuildToolsLootTestDB.checklistHidden = false
  checklistFrame:Show()
  refreshChecklist()
end

local function toggleChecklist()
  if checklistFrame and checklistFrame:IsShown() then
    GuildToolsLootTestDB.checklistHidden = true
    checklistFrame:Hide()
  else
    showChecklist()
  end
end

-- What the addon can see for itself: a NEW captured win or loss ticks the matching items, tagged with the
-- kind of content it came from. Polled, not hooked, so the real capture code stays untouched; the
-- self-test's fake win is removed within the same call, so it is never seen here.
local lastWinCount, lastLossCount
local function pollChecklist()
  local wins = GuildToolsLootTestDB.records or {}
  local losses = GuildToolsLootTestDB.needLosses or {}
  if lastWinCount == nil then lastWinCount, lastLossCount = #wins, #losses end
  local states = checklistStates()
  local function tagContent(r)
    local kind = r.contentType
    if kind == "raid" then states.raid = "pass"
    elseif kind == "party" then states.dungeon = "pass"
    elseif kind == "scenario" then states.delve = "pass" end
  end
  for i = lastWinCount + 1, #wins do
    states.win = "pass"
    tagContent(wins[i])
  end
  for i = lastLossCount + 1, #losses do
    states.loss = "pass"
    tagContent(losses[i])
  end
  lastWinCount, lastLossCount = #wins, #losses
  states.loaded = "pass"
  refreshChecklist()
end

local function checklistCommand(rest)
  local arg = rest or ""
  if arg == "reset" then
    GuildToolsLootTestDB.checklist = {}
    pollChecklist()
    announce("checklist cleared.")
  elseif arg == "text" then
    pollChecklist()
    local done, total = checklistCounts()
    announce("checklist " .. done .. "/" .. total .. ":")
    for _, line in ipairs(checklistLines()) do announce(line) end
  elseif arg == "refresh" then
    pollChecklist()
  else
    pollChecklist()
    toggleChecklist()
  end
end

local function checkCommand(id)
  local c = CHECK_INDEX[id or ""]
  if not c then
    announce("no such checklist item. Manual items: marker, live_app, reload, discord, verify  (e.g. /gtloottest check marker)")
    return
  end
  if c.kind ~= "manual" then
    announce(c.id .. " ticks itself -- you can't set it by hand.")
    return
  end
  cycleCheck(c)
  local st = checkState(c)
  announce(c.id .. ": " .. (st == "pass" and "done" or st == "fail" and "FAILED" or "cleared") .. ".")
end

-- keep the overlay current without anyone typing: look for new captures every couple of seconds
do
  local elapsed = 0
  local ticker = CreateFrame("Frame")
  ticker:SetScript("OnUpdate", function(_, dt)
    elapsed = elapsed + (dt or 0)
    if elapsed >= 2 then
      elapsed = 0
      pollChecklist()
    end
  end)
end

local function testHelp()
  announce("test commands (same names as the real /gtloot, plus more):")
  announce("  /gtloottest on | off | scan | chatlog   -- as the real addon")
  announce("  /gtloottest track [all|strict]          -- tracking is ALL content by default")
  announce("  /gtloottest last [n]                    -- what was captured, and where (zone / dungeon / raid / difficulty)")
  announce("  /gtloottest selftest                    -- fake Need win through the real capture code: PASS/FAIL")
  announce("  /gtloottest logmark                     -- write a marker and check it lands in WoWChatLog.txt")
  announce("  /gtloottest checklist [text|reset]      -- the on-screen test checklist (drag it; ticks itself)")
  announce("  /gtloottest check <id>                  -- tick a manual item: marker, live_app, reload, discord, verify")
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
  elseif arg == "checklist" or arg == "list" then
    checklistCommand(rest)
  elseif arg == "check" then
    checkCommand(rest)
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
    pollChecklist()
    if not GuildToolsLootTestDB.checklistHidden then showChecklist() end
  end)
end
