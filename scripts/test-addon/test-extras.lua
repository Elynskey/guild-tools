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
--   /gtloottest debug                where you are, how loot is handed out, what logging is on (saved too)
--   /gtloottest lootlines [n]        the raw CHAT_MSG_LOOT text the game handed this addon, and whether it matches
--   /gtloottest sync                 reload the UI now so Guild Tools gets your loot (also the click-to-sync button)
--   /gtloottest flushtest            try ways to make WoW write WoWChatLog.txt now, without a reload
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
local updateSyncPrompt -- assigned in the sync section below (the 2-second ticker above it calls it)

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
  f:SetSize(470, 76 + #CHECKS * 20 + 44)
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

  -- The commands, so nobody has to remember them mid-raid. /gtloottest help says what each one does.
  f.commands = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.commands:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", 16, 14)
  f.commands:SetWidth(440)
  f.commands:SetJustifyH("LEFT")
  f.commands:SetText("|cffffd100/gtloottest|r  selftest  debug  lootlines  sync  flushtest  last  logmark  track  check  checklist  help")

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
      updateSyncPrompt()
    end
  end)
end

-- ---------------------------------------------------------------------------------------------
-- Raw loot lines: every CHAT_MSG_LOOT the game hands this addon, kept as-is (newest last, capped),
-- with whether the addon's own Need-win pattern matches it. When a win "wasn't captured" this is
-- the evidence for WHY: the game never sent it (personal loot / not in the group), it sent it in a
-- shape the pattern doesn't match, or it was a protected ("secret") value the addon cannot read.
-- ---------------------------------------------------------------------------------------------
local MAX_LOOT_LINES = 80

local function testMatchesNeedWin(message)
  local winner, rollType = message:match(WON_ROLL_PATTERN)
  if winner and rollType and rollType:lower():find("need") then return true, winner, rollType end
  return false, winner, rollType
end

local function rememberLootLine(message)
  local db = GuildToolsLootTestDB
  db.lootLines = db.lootLines or {}
  db.lootLineStats = db.lootLineStats or { seen = 0, secret = 0, unreadable = 0 }
  db.lootLineStats.seen = db.lootLineStats.seen + 1
  if issecretvalue and issecretvalue(message) then
    db.lootLineStats.secret = db.lootLineStats.secret + 1
    return
  end
  local ok = pcall(function()
    local matches = testMatchesNeedWin(message)
    local zone, instanceType, difficultyID = GetInstanceInfo()
    db.lootLines[#db.lootLines + 1] = {
      at = time(),
      text = message,
      matches = matches,
      zone = zone,
      instanceType = instanceType,
      difficultyID = difficultyID,
    }
    while #db.lootLines > MAX_LOOT_LINES do table.remove(db.lootLines, 1) end
  end)
  if not ok then db.lootLineStats.unreadable = db.lootLineStats.unreadable + 1 end
end

do
  local lootLineFrame = CreateFrame("Frame")
  lootLineFrame:RegisterEvent("CHAT_MSG_LOOT")
  lootLineFrame:SetScript("OnEvent", function(_, _, message)
    if GuildToolsLootTestDB then rememberLootLine(message) end
  end)
end

local function showLootLines(arg)
  local db = GuildToolsLootTestDB
  local lines = db.lootLines or {}
  local stats = db.lootLineStats or { seen = 0, secret = 0, unreadable = 0 }
  local n = tonumber(arg) or 8
  announce(stats.seen .. " loot line(s) seen since this data was created, " .. #lines .. " kept" ..
    (stats.secret > 0 and (", " .. stats.secret .. " were protected values the addon cannot read") or "") ..
    (stats.unreadable > 0 and (", " .. stats.unreadable .. " could not be stored") or "") .. ".")
  if #lines == 0 then
    announce("none yet: no loot has been announced to you. In personal loot nobody sees anyone's loot roll, and only a group with group loot, need-before-greed or master looter announces Need rolls.")
    return
  end
  for i = #lines, math.max(1, #lines - n + 1), -1 do
    local l = lines[i]
    announce(date("%H:%M:%S", l.at) .. (l.matches and "  [NEED WIN]  " or "  [not a need win]  ") .. tostring(l.text))
  end
  announce("[NEED WIN] = the addon's pattern matches it and it would be captured (if the zone is tracked).")
end

-- ---------------------------------------------------------------------------------------------
-- /gtloottest debug: the facts that decide whether loot can be captured here at all.
-- ---------------------------------------------------------------------------------------------
local LOOT_METHOD_NAMES = { [0] = "Free for all", [1] = "Round robin", [2] = "Master looter", [3] = "Group loot", [4] = "Need before greed", [5] = "Personal loot" }

-- Asks BOTH loot-method APIs and keeps their raw answers, so a wrong or missing reading is visible instead of
-- being turned into a confident sentence. Returns: name, isPersonal, detail (the raw readings).
local function lootMethodInfo()
  local function ask(fn)
    if not fn then return nil end
    local ok, v = pcall(fn)
    if ok then return v end
    return nil
  end
  local function describe(raw)
    if raw == nil then return nil end
    if type(raw) == "number" then return LOOT_METHOD_NAMES[raw] or ("method " .. raw) end
    return tostring(raw)
  end
  local newRaw = ask(C_PartyInfo and C_PartyInfo.GetLootMethod)
  local oldRaw = ask(GetLootMethod)
  local name = describe(newRaw) or describe(oldRaw)
  local detail = "C_PartyInfo.GetLootMethod = " .. tostring(newRaw) .. ";  GetLootMethod = " .. tostring(oldRaw)
  if name == nil then return "unknown", false, detail end
  return name, name:lower():find("personal") ~= nil, detail
end

local function debugInfo()
  local d = {}
  d.at = time()
  local zone, instanceType, difficultyID, _, _, _, _, instanceID = GetInstanceInfo()
  d.zone, d.instanceType, d.difficultyID, d.instanceID = zone, instanceType, difficultyID, instanceID
  d.difficulty = (difficultyID and difficultyID ~= 0 and GetDifficultyInfo and GetDifficultyInfo(difficultyID)) or nil
  d.inRaid = IsInRaid and IsInRaid() or false
  d.inGroup = IsInGroup and IsInGroup() or false
  d.groupSize = GetNumGroupMembers and GetNumGroupMembers() or nil
  d.lootMethod, d.personalLoot, d.lootMethodDetail = lootMethodInfo()
  d.chatLogging = isChatLoggingAPI() and C_ChatInfo.IsLoggingChat() or nil
  d.combatLogging = LoggingCombat and LoggingCombat() or nil
  d.tracking = testTrackAll() and "ALL content" or "STRICT"
  d.realAddonLoaded = (C_AddOns and C_AddOns.IsAddOnLoaded and C_AddOns.IsAddOnLoaded("GuildToolsLoot")) or (IsAddOnLoaded and IsAddOnLoaded("GuildToolsLoot")) or false
  d.testAddonVersion = (C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata("GuildToolsLootTest", "Version")) or nil
  if GetBuildInfo then d.gameVersion, d.gameBuild = GetBuildInfo() end
  d.wins = #(GuildToolsLootTestDB.records or {})
  d.losses = #(GuildToolsLootTestDB.needLosses or {})
  d.lootLinesSeen = (GuildToolsLootTestDB.lootLineStats and GuildToolsLootTestDB.lootLineStats.seen) or 0
  return d
end

local function showDebug()
  local d = debugInfo()
  GuildToolsLootTestDB.debug = d
  local where = d.zone and d.zone ~= "" and d.zone or "no instance"
  announce("where: " .. where .. " (" .. tostring(d.instanceType) .. (d.difficulty and (", " .. d.difficulty) or "") .. ", difficulty id " .. tostring(d.difficultyID) .. ")")
  announce("group: " .. (d.inRaid and "raid" or d.inGroup and "party" or "solo") .. (d.groupSize and (", " .. d.groupSize .. " member(s)") or ""))
  announce("loot method: " .. d.lootMethod .. "   [" .. d.lootMethodDetail .. "]")
  if d.personalLoot then
    -- Not a verdict: seen live 2026-09-19 (WoW 12.1.0), Raid Finder read "Personal loot" here while the raid
    -- rolled Need/Greed on every drop. The loot-method reading does not decide whether rolls happen.
    announce("  the game reads PERSONAL LOOT" .. (d.inGroup and "" or " (you are not in a group, which is the game's default when alone)") .. ". That reading is NOT a reliable sign that nobody rolls: Raid Finder read this way while the raid was rolling Need on everything. Trust /gtloottest lootlines, which shows the loot text that actually arrives.")
  elseif d.lootMethod == "unknown" then
    announce("  the game would not say how loot is handed out; trust /gtloottest lootlines to show what actually arrives.")
  end
  announce("chat logging: " .. (d.chatLogging == nil and "unavailable" or d.chatLogging and "ON" or "OFF") .. ",  combat logging: " .. (d.combatLogging == nil and "unavailable" or d.combatLogging and "ON" or "OFF"))
  announce("tracking: " .. d.tracking .. ";  captured so far: " .. d.wins .. " win(s), " .. d.losses .. " lost roll(s);  loot lines seen: " .. d.lootLinesSeen)
  announce("real /gtloot addon is " .. (d.realAddonLoaded and "ALSO loaded (both record, on separate data)" or "not loaded") .. ";  test addon " .. tostring(d.testAddonVersion or "?") .. ";  game " .. tostring(d.gameVersion or "?") .. " (" .. tostring(d.gameBuild or "?") .. ")")
  announce("saved into GuildToolsLootTestDB.debug -- it reaches the file at /reload or logout.")
end

-- ---------------------------------------------------------------------------------------------
-- One-click sync. WoW writes this addon's saved data (and buffers the chat log) only at /reload or logout, and
-- ReloadUI() needs a real click or key press, so it cannot be done on a timer. Instead: once new loot results have
-- been captured and things have been quiet for a moment, a small button offers the reload. One click, and Guild
-- Tools has the wins within seconds. Never shown in combat or during an encounter.
-- ---------------------------------------------------------------------------------------------
local SYNC_QUIET_SECONDS = 15
local syncBase          -- counts when this session loaded: everything after it is not on disk yet
local syncSeen          -- counts at the last look, to notice a change
local syncChangedAt = 0
local syncFrame

local function syncCounts()
  local db = GuildToolsLootTestDB or {}
  return { r = #(db.records or {}), l = #(db.needLosses or {}), t = #(db.trades or {}) }
end

local function syncPending()
  if not syncBase then return 0 end
  local c = syncCounts()
  return math.max(0, c.r - syncBase.r) + math.max(0, c.l - syncBase.l) + math.max(0, c.t - syncBase.t)
end

local function syncNow()
  announce("syncing: reloading the UI so Guild Tools gets your loot...")
  if not ReloadUI then
    announce("this client has no ReloadUI here -- type /reload yourself.")
    return
  end
  local ok, err = pcall(ReloadUI)
  if not ok then announce("the game would not reload from here (" .. tostring(err) .. ") -- type /reload yourself.") end
end

local function shouldShowSync()
  if GuildToolsLootTestDB.syncPromptOff then return false end
  local pending = syncPending()
  if pending <= 0 then return false end
  if GetTime() - syncChangedAt < SYNC_QUIET_SECONDS then return false end
  if IsEncounterInProgress and IsEncounterInProgress() then return false end
  if InCombatLockdown and InCombatLockdown() then return false end
  return true
end

local function buildSyncFrame()
  local f = CreateFrame("Button", "GuildToolsLootTestSync", UIParent, "UIPanelButtonTemplate")
  f:SetSize(330, 34)
  local pos = GuildToolsLootTestDB.syncPos
  if pos then f:SetPoint(pos.point, UIParent, pos.relPoint, pos.x, pos.y) else f:SetPoint("TOP", UIParent, "TOP", 0, -140) end
  f:SetFrameStrata("DIALOG")
  f:SetMovable(true)
  f:RegisterForDrag("RightButton")
  f:RegisterForClicks("LeftButtonUp")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local point, _, relPoint, x, y = self:GetPoint()
    GuildToolsLootTestDB.syncPos = { point = point, relPoint = relPoint, x = x, y = y }
  end)
  f:SetScript("OnClick", function() syncNow() end)
  f:SetScript("OnEnter", function(self)
    if GameTooltip then
      GameTooltip:SetOwner(self, "ANCHOR_BOTTOM")
      GameTooltip:SetText("Sync loot to Guild Tools")
      GameTooltip:AddLine("Reloads the UI, which is what makes WoW write your loot to disk. Left-click to sync. Drag with the right mouse button to move. /gtloottest syncoff hides this button.", 1, 1, 1, true)
      GameTooltip:Show()
    end
  end)
  f:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
  return f
end

updateSyncPrompt = function()
  if not GuildToolsLootTestDB or not syncBase then return end
  local c = syncCounts()
  if not syncSeen or c.r ~= syncSeen.r or c.l ~= syncSeen.l or c.t ~= syncSeen.t then
    syncSeen = c
    syncChangedAt = GetTime()
  end
  local show = shouldShowSync()
  if not show and not syncFrame then return end
  if not syncFrame then
    local ok, result = pcall(buildSyncFrame)
    if not ok then
      announce("couldn't draw the sync button (" .. tostring(result) .. ") -- type /gtloottest sync when you want to sync.")
      GuildToolsLootTestDB.syncPromptOff = true
      return
    end
    syncFrame = result
  end
  if show then
    syncFrame:SetText("Loot ready: click to sync (" .. syncPending() .. " new)")
    syncFrame:Show()
  else
    syncFrame:Hide()
  end
end

local function initSyncBaseline()
  syncBase = syncCounts()
  syncSeen = syncBase
  syncChangedAt = GetTime()
end

-- ---------------------------------------------------------------------------------------------
-- /gtloottest flushtest: WoW keeps chat lines in memory and writes WoWChatLog.txt only at /reload or logout
-- (confirmed live 2026-09-19). This tries the ways an addon can ask for the file to be closed and reopened, one
-- every 20 seconds, and records the exact time of each so an outside watcher can match them to the moment the file
-- grew. Whichever one makes it grow can then run automatically after every boss, with no reload.
-- ---------------------------------------------------------------------------------------------
local FLUSH_STEP_SECONDS = 20

local function flushTest()
  if not isChatLoggingAPI() then
    announce("can't read chat logging on this client, so this test can't run.")
    return
  end
  local stages = {}
  GuildToolsLootTestDB.flushtest = { startedAt = time(), hasLoggingChat = LoggingChat ~= nil, hasSlash = (SlashCmdList and SlashCmdList["CHATLOG"]) ~= nil, stages = stages }

  local function stamp(name)
    stages[#stages + 1] = { name = name, at = time(), reads = C_ChatInfo.IsLoggingChat() and "ON" or "OFF" }
    announce(date("%H:%M:%S") .. "  " .. name)
  end
  local function slash()
    if SlashCmdList and SlashCmdList["CHATLOG"] then SlashCmdList["CHATLOG"]("") end
  end
  -- The setter when this client has it, else the /chatlog toggle -- only ever acting if the reading needs to change,
  -- so it can never flip the wrong way.
  local function api(on)
    if C_ChatInfo.IsLoggingChat() == on then return end
    if LoggingChat then LoggingChat(on) else slash() end
  end

  announce("flush test: " .. (LoggingChat and "LoggingChat is available" or "LoggingChat is NOT available") .. ", " .. ((SlashCmdList and SlashCmdList["CHATLOG"]) and "/chatlog handler is available" or "/chatlog handler is NOT available") .. ". Four steps, " .. FLUSH_STEP_SECONDS .. "s apart; chat logging ends ON. Keep chatting or wait for guild traffic; watching happens outside the game.")
  if not C_ChatInfo.IsLoggingChat() then api(true) end

  C_Timer.After(5, function()
    stamp("STEP 1: LoggingChat(false), then LoggingChat(true) one second later")
    api(false)
    C_Timer.After(1, function() api(true); stamp("STEP 1 done") end)
  end)
  C_Timer.After(5 + FLUSH_STEP_SECONDS, function()
    stamp("STEP 2: the /chatlog command twice, one second apart")
    slash()
    C_Timer.After(1, function() slash(); stamp("STEP 2 done") end)
  end)
  C_Timer.After(5 + FLUSH_STEP_SECONDS * 2, function()
    stamp("STEP 3: logging OFF for six seconds, then ON")
    api(false)
    C_Timer.After(6, function() api(true); stamp("STEP 3 done") end)
  end)
  C_Timer.After(5 + FLUSH_STEP_SECONDS * 3, function()
    if not C_ChatInfo.IsLoggingChat() then api(true) end
    stamp("STEP 4: finished. If nothing above made the file grow, take any loading screen now (zone through a portal or hearth) and tell me the time")
    announce("flush test finished; chat logging reads " .. (C_ChatInfo.IsLoggingChat() and "ON" or "OFF") .. ". The step times are saved (GuildToolsLootTestDB.flushtest) and reach the file at your next reload or logout.")
  end)
end

local function testHelp()
  announce("test commands (same names as the real /gtloot, plus more):")
  announce("  /gtloottest on | off | scan | chatlog   -- as the real addon")
  announce("  /gtloottest track [all|strict]          -- tracking is ALL content by default")
  announce("  /gtloottest last [n]                    -- what was captured, and where (zone / dungeon / raid / difficulty)")
  announce("  /gtloottest selftest                    -- fake Need win through the real capture code: PASS/FAIL")
  announce("  /gtloottest logmark                     -- write a marker and check it lands in WoWChatLog.txt")
  announce("  /gtloottest debug                       -- where you are, how loot is handed out (personal loot?), what logging is on")
  announce("  /gtloottest lootlines [n]               -- the raw loot text the game sent this addon, and whether it would be captured")
  announce("  /gtloottest checklist [text|reset]      -- the on-screen test checklist (drag it; ticks itself)")
  announce("  /gtloottest check <id>                  -- tick a manual item: marker, live_app, reload, discord, verify")
  announce("  /gtloottest sync                        -- reload now so Guild Tools gets your loot (also the click-to-sync button that appears after loot)")
  announce("  /gtloottest flushtest                   -- try ways to make WoW write WoWChatLog.txt without a reload (four steps, ~65 s)")
  announce("  /gtloottest help                        -- this list")
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
  elseif arg == "sync" then
    syncNow()
  elseif arg == "syncoff" then
    GuildToolsLootTestDB.syncPromptOff = not GuildToolsLootTestDB.syncPromptOff
    if syncFrame then syncFrame:Hide() end
    announce("the click-to-sync button is now " .. (GuildToolsLootTestDB.syncPromptOff and "OFF" or "ON") .. ". /gtloottest sync still works.")
  elseif arg == "flushtest" then
    flushTest()
  elseif arg == "debug" then
    showDebug()
  elseif arg == "lootlines" then
    showLootLines(rest)
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
    initSyncBaseline()
    if not GuildToolsLootTestDB.checklistHidden then showChecklist() end
  end)
end
