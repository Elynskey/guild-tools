-- Test-only additions, appended by scripts/make-test-addon.mjs to the generated GuildToolsLootTest
-- addon (never part of the real GuildToolsLoot addon or the app installer). Everything here is
-- for trying things on a real client; each command says plainly what it did and what it saw.
--
--   /gtloottest track [all|strict]   what is tracked (all content by default; strict = the real addon's rules)
--   /gtloottest last [n]             the last n Need wins this addon captured, and where each came from
--   /gtloottest selftest             push a fake Need win through the real capture code and say PASS/FAIL
--   /gtloottest logmark              write a marker line and check the game really writes the chat log
--   /gtloottest checklist [text|reset]  the in-game checklist of what is still to be tested (ticks itself where it can)
--   /gtloottest check <id>           cycle a manual item: unchecked -> done -> failed
--   /gtloottest debug                where you are, how loot is handed out, what logging is on (saved too)
--   /gtloottest lootlines [n]        the raw CHAT_MSG_LOOT text the game handed this addon, and whether it matches
--   /gtloottest sync                 reload the UI now so Guild Tools gets your loot (also the click-to-sync button)
--   /gtloottest synctest             pretend another officer already synced (your sync button closes)
--   /gtloottest flushtest            try ways to make WoW write WoWChatLog.txt now, without a reload
--   /gtloottest calendar             read the next 14 days of calendar events and who's coming (saved for Guild Tools)
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
  { id = "flush", kind = "auto", text = "Ran /gtloottest flushtest (Claude reads which step worked)", hint = "four steps, 20 s apart, ~65 s: keep chatting, then tell Claude it finished" },
  { id = "syncbtn", kind = "auto", text = "The 'Loot ready: click to sync' button appeared", hint = "after a win or lost roll, ~15 s of quiet, out of combat" },
  { id = "syncclick", kind = "auto", text = "Sync reloaded the UI (button click or /gtloottest sync)", hint = "if it says 'type /reload yourself', tell Claude what it printed" },
  { id = "synccover", kind = "auto", text = "Another officer's sync closed your button (/gtloottest synctest pretends one)", hint = "needs a captured win with an encounter recorded" },
  { id = "app_sync", kind = "manual", text = "Test app + Discord got the win within ~15 s of the sync", hint = "Loot History (Guild Tools (Test)) and CRD-TEST #loot-need-wins" },
  { id = "once", kind = "manual", text = "Each win was posted to Discord exactly ONCE", hint = "no duplicates (a bug on 9/19: every win posted twice)" },
  { id = "chatpath", kind = "auto", text = "The chat-text path saw a win (lootlines shows [NEED WIN])", hint = "addon 1.7 fix: the game now writes ', Main-Spec' in the roll" },
  { id = "selfwin", kind = "auto", text = "Your own win was recorded once, under your name", hint = "not as 'You', and not twice" },
  { id = "dungeon", kind = "auto", text = "A win or lost roll captured in a DUNGEON", hint = "any dungeon, any level" },
  { id = "delve", kind = "auto", text = "A win or lost roll captured in a DELVE / scenario", hint = "only if it rolls" },
  { id = "legacy", kind = "manual", text = "Older raid (Dragonflight): ran /gtloottest lootlines after a boss", hint = "does the game announce rolls there? Tell Claude what it showed" },
}
local CHECK_INDEX = {}
for _, c in ipairs(CHECKS) do CHECK_INDEX[c.id] = c end

local function checklistStates()
  GuildToolsLootTestDB.checklist = GuildToolsLootTestDB.checklist or {}
  return GuildToolsLootTestDB.checklist
end

-- "pass" | "fail" | nil for one item
local function checkState(c)
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
    local w = wins[i]
    tagContent(w)
    -- Your own win: recorded under your character name (not the word "You") and only once. The addon has two paths
    -- that can both see the same win; a second copy inside a minute means they did not dedupe.
    if w.self and w.winner == UnitName("player") then
      local copies = 0
      for _, other in ipairs(wins) do
        if other.itemId == w.itemId and other.winner == w.winner and math.abs((other.time or 0) - (w.time or 0)) <= 60 then copies = copies + 1 end
      end
      if copies > 1 then states.selfwin = "fail" elseif states.selfwin ~= "fail" then states.selfwin = "pass" end
    end
  end
  for i = lastLossCount + 1, #losses do
    tagContent(losses[i])
  end
  lastWinCount, lastLossCount = #wins, #losses
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
    announce("no such checklist item. Manual items: app_sync, once, legacy  (e.g. /gtloottest check once)")
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
  local winner, rollType = plainLootText(message):match(WON_ROLL_PATTERN)
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
    if matches then
      GuildToolsLootTestDB.checklist = GuildToolsLootTestDB.checklist or {}
      GuildToolsLootTestDB.checklist.chatpath = "pass"
    end
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
-- One-click sync. WoW writes this addon's saved data at /reload or logout (the chat log only at logout), and
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

-- Loot another raid member has already synced. Their sync message names the encounters it covered; anything of ours from those
-- encounters captured up to that moment is the same rolls (every roll is broadcast to the whole group), so our own sync
-- would only repeat it. Kept in memory only: a reload or logout clears it, and our own data is saved either way, so hiding
-- the button never loses anything -- at worst our copy reaches Guild Tools at our next reload or logout instead.
local SYNC_PREFIX = "GTLSYNC"
local syncCovered = {} -- encounterId -> time() the covering message arrived

local function syncIsCovered(rec)
  local at = rec.encounterId and syncCovered[rec.encounterId]
  return at ~= nil and (rec.time or 0) <= at
end

-- What a sync would carry that nobody else has already synced: wins, lost rolls, trades, and the encounters they belong to.
local function syncPendingParts()
  if not syncBase then return 0, 0, 0, {} end
  local db = GuildToolsLootTestDB or {}
  local wins, losses = 0, 0
  local encounters, seen = {}, {}
  local function noteEncounter(rec)
    if rec.encounterId and not seen[rec.encounterId] then
      seen[rec.encounterId] = true
      encounters[#encounters + 1] = rec.encounterId
    end
  end
  for i = syncBase.r + 1, #(db.records or {}) do
    local rec = db.records[i]
    if not syncIsCovered(rec) then wins = wins + 1; noteEncounter(rec) end
  end
  for i = syncBase.l + 1, #(db.needLosses or {}) do
    local rec = db.needLosses[i]
    if not syncIsCovered(rec) then losses = losses + 1; noteEncounter(rec) end
  end
  local trades = math.max(0, #(db.trades or {}) - syncBase.t)
  return wins, losses, trades, encounters
end

local function syncPending()
  local wins, losses, trades = syncPendingParts()
  return wins + losses + trades
end

-- "3 Need win(s) and 12 lost roll(s)": what a sync will carry, in words.
local function describeLoot(wins, losses, trades)
  local parts = {}
  if wins > 0 then parts[#parts + 1] = wins .. " Need win(s)" end
  if losses > 0 then parts[#parts + 1] = losses .. " lost roll(s)" end
  if trades > 0 then parts[#parts + 1] = trades .. " trade(s)" end
  if #parts == 0 then return "nothing new" end
  return table.concat(parts, " and ")
end

local syncAnnouncedFor = 0 -- the pending count the chat message was last printed for, so it is said once per batch

local function syncNow()
  announce("syncing: reloading the UI so Guild Tools gets your loot...")
  local states = checklistStates()
  if not ReloadUI then
    states.syncclick = "fail"
    announce("this client has no ReloadUI here -- type /reload yourself.")
    return
  end
  -- Ticked BEFORE the reload: the reload is what writes this table to disk. The note is what the chat message after the
  -- reload reads (it is written to disk by the same reload).
  states.syncclick = "pass"
  local wins, losses, trades, encounters = syncPendingParts()
  GuildToolsLootTestDB.syncNote = { wins = wins, losses = losses, trades = trades, encounters = encounters, at = time() }
  local ok, err = pcall(ReloadUI)
  if not ok then
    states.syncclick = "fail"
    GuildToolsLootTestDB.syncNote = nil
    announce("the game would not reload from here (" .. tostring(err) .. ") -- type /reload yourself.")
  end
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
  if show then
    local pending = syncPending()
    if syncAnnouncedFor ~= pending then
      syncAnnouncedFor = pending
      announce("Loot logged: " .. describeLoot(syncPendingParts()) .. ". Click the sync button (or type /gtloottest sync) to send it to Guild Tools.")
    end
  elseif syncPending() == 0 then
    syncAnnouncedFor = 0
  end
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
    checklistStates().syncbtn = "pass"
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
  syncAnnouncedFor = 0
  syncCovered = {} -- a fresh session (login or reload): whatever others synced earlier is already in the baseline
end

-- Tells the rest of the group which encounters this sync covered, so their sync buttons close (they would only repeat it).
-- Sent AFTER the reload, once the chat channels are ready: a message queued at the moment of the click can be lost to
-- the reload, and ReloadUI must be called from the click itself so it cannot wait for the message. Not sent while the game
-- restricts addon chat (an encounter in progress); tried again a few times. Only ever a convenience: nothing depends on it.
local function broadcastSynced(encounters)
  if not encounters or #encounters == 0 then return end
  if not (C_ChatInfo and C_ChatInfo.SendAddonMessage) then return end
  local ids = {}
  for i = 1, math.min(#encounters, 12) do ids[#ids + 1] = tostring(encounters[i]) end
  local message = "S1;" .. table.concat(ids, ",")
  local attempts = 0
  local function try()
    attempts = attempts + 1
    local channel = groupChannel()
    if not channel then return end
    local sent = false
    if not (C_ChatInfo.InChatMessagingLockdown and C_ChatInfo.InChatMessagingLockdown()) then
      local ok, result = pcall(C_ChatInfo.SendAddonMessage, SYNC_PREFIX, message, channel)
      sent = ok and (result == nil or result == 0 or result == true)
    end
    if not sent and attempts < 4 then C_Timer.After(10, try) end
  end
  C_Timer.After(5, try)
end

-- The confirmation after a sync's reload. All the addon can honestly say is that the loot is logged and saved to disk;
-- whether Guild Tools has picked it up is up to the app (it does within a few seconds when it is open).
local function announceSyncNote()
  local note = GuildToolsLootTestDB.syncNote
  GuildToolsLootTestDB.syncNote = nil
  if note and (time() - (note.at or 0)) < 300 then
    announce("Loot logged and saved: " .. describeLoot(note.wins or 0, note.losses or 0, note.trades or 0) .. ". Guild Tools picks it up within a few seconds if it is open.")
    broadcastSynced(note.encounters)
  end
end

-- A message from another raid member's addon: "S1;3470,3471" = "I synced the loot for these encounters". Only ever closes our
-- own sync button; accepted from group channels only, digits and commas only, and never from ourselves.
local function coverFromPeer(text, sender)
  local ids = text:match("^S1;([%d,]+)$")
  if not ids then return false end
  local before = syncPending()
  local now = time()
  local count = 0
  for id in ids:gmatch("%d+") do
    count = count + 1
    if count > 12 then break end
    syncCovered[tonumber(id)] = now
  end
  if before > 0 and syncPending() == 0 then
    checklistStates().synccover = "pass"
    announce((sender:match("^[^-]+") or sender) .. " already logged this loot and synced it to Guild Tools, so your sync button is closed. Your own copy is still saved when you reload or log out.")
  end
  updateSyncPrompt()
  return true
end

do
  local peerFrame = CreateFrame("Frame")
  if C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then pcall(C_ChatInfo.RegisterAddonMessagePrefix, SYNC_PREFIX) end
  peerFrame:RegisterEvent("CHAT_MSG_ADDON")
  peerFrame:SetScript("OnEvent", function(_, _, prefix, text, channel, sender)
    if prefix ~= SYNC_PREFIX then return end
    if issecretvalue and (issecretvalue(text) or issecretvalue(sender)) then return end
    if type(text) ~= "string" or type(sender) ~= "string" then return end
    if channel ~= "RAID" and channel ~= "PARTY" and channel ~= "INSTANCE_CHAT" then return end
    local me = UnitName("player")
    if me and sender:match("^[^-]+") == me then return end
    coverFromPeer(text, sender)
  end)
end

-- /gtloottest synctest: pretend another officer just synced what we have pending, to see the button close without needing
-- a second officer running this addon.
local function syncPeerTest()
  local _, _, _, encounters = syncPendingParts()
  if #encounters == 0 then
    announce("synctest: nothing pending that has an encounter recorded -- capture a win or lost roll first.")
    return
  end
  announce("synctest: pretending another officer just synced encounter(s) " .. table.concat(encounters, ", ") .. "...")
  coverFromPeer("S1;" .. table.concat(encounters, ","), "TestOfficer-Realm")
  local left = syncPending()
  announce("synctest: your sync button " .. (left == 0 and "is closed (works)." or "is still open: " .. left .. " item(s) have no encounter recorded, so nobody's message can cover them."))
end

-- ---------------------------------------------------------------------------------------------
-- /gtloottest flushtest: WoW keeps chat lines in memory and writes WoWChatLog.txt only at logout (a /reload does not, confirmed 2026-09-20)
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
    checklistStates().flush = "pass"
    announce("flush test finished; chat logging reads " .. (C_ChatInfo.IsLoggingChat() and "ON" or "OFF") .. ". The step times are saved (GuildToolsLootTestDB.flushtest) and reach the file at your next reload or logout.")
  end)
end

-- ---------------------------------------------------------------------------------------------
-- /gtloottest drops: is the game's own loot history (C_LootHistory) giving this addon anything? It is the only source of the
-- per-drop ID that tells two rolls on two copies of one item apart. An LFR test night (2026-09-23) captured the wins from chat
-- text but none from here, so this asks the game directly and saves exactly what it answered.
-- ---------------------------------------------------------------------------------------------
local function dropValue(v)
  if issecretvalue and issecretvalue(v) then return "<secret>" end
  local t = type(v)
  if t == "table" or t == "function" or t == "userdata" then return "<" .. t .. ">" end
  local text = tostring(v)
  if #text > 48 then text = text:sub(1, 48) .. "..." end
  return text
end

local function dropShape(tbl)
  if type(tbl) ~= "table" then return dropValue(tbl) end
  local parts = {}
  for k, v in pairs(tbl) do parts[#parts + 1] = tostring(k) .. "=" .. dropValue(v) end
  table.sort(parts)
  return table.concat(parts, ", ")
end

do
  local dropFrame = CreateFrame("Frame")
  dropFrame:RegisterEvent("LOOT_HISTORY_UPDATE_DROP")
  dropFrame:SetScript("OnEvent", function(_, _, encounterID, lootListID)
    local db = GuildToolsLootTestDB
    if not db then return end
    db.dropEvents = db.dropEvents or { count = 0 }
    db.dropEvents.count = db.dropEvents.count + 1
    pcall(function()
      local info = C_LootHistory and C_LootHistory.GetSortedInfoForDrop and C_LootHistory.GetSortedInfoForDrop(encounterID, lootListID)
      -- The same checks the real capture makes, in the same order, so the first one that fails is named. An LFR night showed
      -- these events firing with full data while nothing was recorded from them.
      local reason
      local winningRoll
      if not info then reason = "noInfo"
      elseif not info.winner then reason = "noWinner"
      elseif type(info.rollInfos) ~= "table" then reason = "noRollInfos"
      else
        for _, roll in ipairs(info.rollInfos) do
          if roll.isWinner then winningRoll = roll break end
        end
        local enum = Enum and Enum.EncounterLootDropRollState
        if not winningRoll then reason = "noRollHasIsWinner"
        elseif enum and (winningRoll.state == enum.NeedMainSpec or winningRoll.state == enum.NeedOffSpec) then reason = "wouldRecord"
        else reason = "winnerNotNeed(state=" .. dropValue(winningRoll.state) .. ")" end
      end
      db.dropEvents.reasons = db.dropEvents.reasons or {}
      db.dropEvents.reasons[reason] = (db.dropEvents.reasons[reason] or 0) + 1
      local rolls = {}
      if info and type(info.rollInfos) == "table" then
        for k, roll in ipairs(info.rollInfos) do if k <= 3 then rolls[#rolls + 1] = dropShape(roll) end end
      end
      db.dropEvents.last = {
        at = time(), encounterID = dropValue(encounterID), lootListID = dropValue(lootListID), reason = reason,
        hasInfo = info ~= nil, hasWinner = (info and info.winner ~= nil) or false,
        rolls = (info and type(info.rollInfos) == "table") and #info.rollInfos or nil, shape = dropShape(info),
        winner = info and dropShape(info.winner) or nil, rollShapes = rolls,
      }
    end)
  end)
end

local function dropsProbe()
  local db = GuildToolsLootTestDB
  local LH = C_LootHistory
  local probe = { at = time(), apis = {}, states = {}, encounters = {} }
  for _, name in ipairs({ "GetAllEncounterInfos", "GetSortedDropsForEncounter", "GetSortedInfoForDrop" }) do
    probe.apis[name] = (LH and LH[name] ~= nil) or false
  end
  local enum = Enum and Enum.EncounterLootDropRollState
  if enum then for k, v in pairs(enum) do probe.states[k] = v end end

  local ids, names = {}, {}
  for idText, name in pairs(GuildToolsLootTestDB.seenEncounters or {}) do
    local id = tonumber(idText)
    if id then ids[#ids + 1] = id names[id] = name end
  end
  if LH and LH.GetAllEncounterInfos then
    local ok, infos = pcall(LH.GetAllEncounterInfos)
    probe.allInfosOk = ok
    if ok and type(infos) == "table" then
      probe.allInfosCount = #infos
      for _, info in ipairs(infos) do
        if info.encounterID and not names[info.encounterID] then
          ids[#ids + 1] = info.encounterID names[info.encounterID] = info.encounterName or "?"
        end
      end
    end
  end
  table.sort(ids, function(a, b) return a > b end)

  for i = 1, math.min(#ids, 6) do
    local id = ids[i]
    local enc = { id = id, name = names[id], drops = 0, samples = {} }
    if LH and LH.GetSortedDropsForEncounter then
      local ok, drops = pcall(LH.GetSortedDropsForEncounter, id)
      enc.dropsOk = ok
      if ok and type(drops) == "table" then
        enc.drops = #drops
        for j = 1, math.min(#drops, 3) do
          local sample = { drop = dropShape(drops[j]) }
          if LH.GetSortedInfoForDrop and drops[j].lootListID then
            local ok2, info = pcall(LH.GetSortedInfoForDrop, id, drops[j].lootListID)
            sample.infoOk = ok2
            if ok2 and type(info) == "table" then
              sample.info = dropShape(info)
              sample.winner = dropShape(info.winner)
              sample.rolls = {}
              for k, roll in ipairs(info.rollInfos or {}) do
                if k <= 4 then sample.rolls[#sample.rolls + 1] = dropShape(roll) end
              end
            end
          end
          enc.samples[#enc.samples + 1] = sample
        end
      end
    end
    probe.encounters[#probe.encounters + 1] = enc
  end
  db.dropProbe = probe
  return probe
end

local function showDrops()
  local db = GuildToolsLootTestDB
  local p = dropsProbe()
  local ev = db.dropEvents
  announce("game loot history: " .. (C_LootHistory and "C_LootHistory exists" or "C_LootHistory is MISSING") ..
    "; GetAllEncounterInfos " .. (p.apis.GetAllEncounterInfos and "yes" or "NO") ..
    ", GetSortedDropsForEncounter " .. (p.apis.GetSortedDropsForEncounter and "yes" or "NO") ..
    ", GetSortedInfoForDrop " .. (p.apis.GetSortedInfoForDrop and "yes" or "NO") .. ".")
  announce("roll-state enum: " .. (next(p.states) and dropShape(p.states) or "MISSING (so this addon can never tell a Need from a Greed here)"))
  announce("live drop events since this data was created: " .. (ev and ev.count or 0) ..
    (ev and ev.last and (" (last: encounter " .. ev.last.encounterID .. ", drop " .. ev.last.lootListID .. ", info " .. (ev.last.hasInfo and "yes" or "NO") .. ", winner " .. (ev.last.hasWinner and "yes" or "NO") .. ", rolls " .. tostring(ev.last.rolls) .. ", check: " .. tostring(ev.last.reason) .. ")") or ""))
  if ev and ev.reasons then announce("why events were / were not recorded: " .. dropShape(ev.reasons)) end
  if #p.encounters == 0 then announce("no encounters known yet, so nothing to ask the game about.") end
  for _, e in ipairs(p.encounters) do
    announce(tostring(e.name) .. " (" .. e.id .. "): the game lists " .. e.drops .. " drop(s)" .. ((e.dropsOk == false) and " -- the call ERRORED" or "") .. ".")
    local s = e.samples[1]
    if s then
      announce("   first drop: " .. s.drop)
      announce("   its info: " .. (s.info and (s.info:sub(1, 150) .. "; winner " .. tostring(s.winner):sub(1, 90) .. "; " .. #s.rolls .. " roll(s) shown") or ("NONE" .. ((s.infoOk == false) and " (call errored)" or ""))))
    end
  end
  announce("everything above is saved: reload, then read GuildToolsLootTestDB.dropProbe.")
end

-- Calendar: who's coming to what, so Guild Tools can build M+ groups from an event's sign-ups.
-- The game only hands out an event's invite list once the event is opened (C_Calendar.OpenEvent),
-- and answers later (CALENDAR_OPEN_EVENT) -- sometimes several seconds later (first live run,
-- 2026-09-23: 6 of 13 events missed a 3 s timeout). So events are opened one at a time with a pause
-- between, each answer is matched to its event by title AND time (two "Z's Keys" a week apart), an
-- answer that arrives after its timeout still fills its event in, and anything still missing is
-- opened once more at the end. Saved to GuildToolsLootTestDB.calendar; the app reads it after a
-- /reload or logout, like everything else here.
local CALENDAR_DAYS = 14
local CALENDAR_TIMEOUT = 8
local CALENDAR_GAP = 0.5
local CALENDAR_SKIP = { HOLIDAY = true, SYSTEM = true, RAID_LOCKOUT = true, RAID_RESET = true }
-- Enum.CalendarStatus, by number, so the saved file reads plainly.
local CALENDAR_STATUS = { [0] = "invited", [1] = "available", [2] = "declined", [3] = "confirmed", [4] = "out", [5] = "standby", [6] = "signedup", [7] = "not_signedup", [8] = "tentative" }
local CALENDAR_COMING = { available = true, confirmed = true, signedup = true, tentative = true, standby = true }
local CALENDAR_MISSED = "the game didn't open this event in time"

local calendarScan = nil
local calendarFrame = CreateFrame("Frame")

-- Realm time, as the calendar shows it: "YYYY-MM-DDTHH:MM".
local function calendarStamp(t)
  return string.format("%04d-%02d-%02dT%02d:%02d", t.year, t.month, t.monthDay, t.hour or 0, t.minute or 0)
end

local function readCalendarInvites()
  local invites = {}
  for i = 1, (C_Calendar.GetNumInvites and C_Calendar.GetNumInvites() or 0) do
    local info = C_Calendar.EventGetInvite(i)
    if info and info.name then
      invites[#invites + 1] = { name = info.name, className = info.className, level = info.level, status = CALENDAR_STATUS[info.inviteStatus] or tostring(info.inviteStatus) }
    end
  end
  return invites
end

local function finishCalendarScan()
  local scan = calendarScan
  calendarScan = nil
  calendarFrame:UnregisterEvent("CALENDAR_OPEN_EVENT")
  GuildToolsLootTestDB.calendar = { scannedAt = time(), days = CALENDAR_DAYS, events = scan.events }
  if not scan.verbose then return end
  local missed = 0
  announce("calendar: " .. #scan.events .. " event(s) in the next " .. CALENDAR_DAYS .. " days.")
  for _, e in ipairs(scan.events) do
    local coming = 0
    for _, inv in ipairs(e.invites or {}) do
      if CALENDAR_COMING[inv.status] then coming = coming + 1 end
    end
    if not e.invites then missed = missed + 1 end
    announce("  " .. e.start .. "  " .. tostring(e.title) .. "  -- " .. (e.invites and (coming .. " coming of " .. #e.invites .. " invited") or (e.note or "no invite list")))
  end
  if missed > 0 then announce(missed .. " event(s) had no sign-up list from the game even after a retry -- run /gtloottest calendar again to try those once more.") end
  announce("saved. /reload (or /gtloottest sync) so Guild Tools sees it.")
end

local openNextCalendarEvent
local startCalendarScan

-- Files an event's sign-ups (or why there are none). An event is added to the saved list once;
-- a late answer or a retry just fills in the list on the same entry.
local function fileCalendarEvent(scan, pending, invites, note)
  pending.event.invites = invites
  pending.event.note = note
  pending.missed = (invites == nil)
  if not pending.filed then
    pending.filed = true
    scan.events[#scan.events + 1] = pending.event
  end
end

openNextCalendarEvent = function()
  local scan = calendarScan
  if not scan then return end
  scan.index = scan.index + 1
  local pending = scan.queue[scan.index]
  if not pending then
    -- One more go at anything the game didn't answer in time.
    if not scan.retried then
      scan.retried = true
      scan.queue, scan.index = {}, 0
      for _, p in ipairs(scan.pending) do
        if p.missed then scan.queue[#scan.queue + 1] = p end
      end
      if #scan.queue > 0 then
        openNextCalendarEvent()
        return
      end
    end
    finishCalendarScan()
    return
  end
  scan.waiting = pending
  C_Calendar.OpenEvent(pending.offset, pending.day, pending.i)
  C_Timer.After(CALENDAR_TIMEOUT, function()
    if calendarScan == scan and scan.waiting == pending then
      scan.waiting = nil
      fileCalendarEvent(scan, pending, nil, CALENDAR_MISSED)
      openNextCalendarEvent()
    end
  end)
end

calendarFrame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    if C_Calendar and C_Calendar.OpenCalendar then C_Calendar.OpenCalendar() end
    -- The calendar fills in a few seconds after login; read it quietly then.
    C_Timer.After(10, function() startCalendarScan(false) end)
    return
  end
  local scan = calendarScan
  if event ~= "CALENDAR_OPEN_EVENT" or not scan then return end
  -- Which of our events is this? Title and time when the game says; otherwise the one we asked for.
  local info = C_Calendar.GetEventInfo and C_Calendar.GetEventInfo()
  local target
  if info and info.title and info.time then
    target = scan.byKey[info.title .. "|" .. calendarStamp(info.time)]
  elseif info and info.title then
    target = (scan.waiting and scan.waiting.event.title == info.title) and scan.waiting or nil
  else
    target = scan.waiting
  end
  if not target then return end -- an event the player opened themselves meanwhile
  local invites = readCalendarInvites()
  if C_Calendar.CloseEvent then C_Calendar.CloseEvent() end
  fileCalendarEvent(scan, target, invites, nil)
  if target == scan.waiting then
    scan.waiting = nil
    C_Timer.After(CALENDAR_GAP, openNextCalendarEvent)
  end
end)
calendarFrame:RegisterEvent("PLAYER_LOGIN")

startCalendarScan = function(verbose)
  if not (C_Calendar and C_Calendar.GetNumDayEvents and C_Calendar.OpenEvent and C_DateAndTime and C_DateAndTime.GetCurrentCalendarTime) then
    if verbose then announce("this client has no calendar API the addon can use.") end
    return
  end
  if calendarScan then
    if verbose then announce("already reading the calendar -- give it a few seconds.") end
    return
  end
  local now = C_DateAndTime.GetCurrentCalendarTime()
  -- Day lookups are relative to the month the calendar is showing; make that this month.
  if C_Calendar.SetAbsMonth then C_Calendar.SetAbsMonth(now.month, now.year) end
  local pending, byKey = {}, {}
  local offset, day = 0, now.monthDay
  local monthDays = C_Calendar.GetMonthInfo(0).numDays
  for _ = 1, CALENDAR_DAYS do
    for i = 1, C_Calendar.GetNumDayEvents(offset, day) do
      local e = C_Calendar.GetDayEvent(offset, day, i)
      if e and e.title and not CALENDAR_SKIP[e.calendarType] then
        local start = calendarStamp(e.startTime)
        local p = { offset = offset, day = day, i = i, event = { title = e.title, calendarType = e.calendarType, start = start } }
        pending[#pending + 1] = p
        byKey[e.title .. "|" .. start] = p
      end
    end
    day = day + 1
    if day > monthDays then
      offset, day = offset + 1, 1
      monthDays = C_Calendar.GetMonthInfo(offset).numDays
    end
  end
  calendarScan = { pending = pending, queue = pending, byKey = byKey, events = {}, index = 0, verbose = verbose }
  calendarFrame:RegisterEvent("CALENDAR_OPEN_EVENT")
  if verbose then announce("reading " .. #pending .. " calendar event(s) in the next " .. CALENDAR_DAYS .. " days (up to " .. CALENDAR_TIMEOUT .. " s each)...") end
  openNextCalendarEvent()
end

local function calendarCommand()
  if C_Calendar and C_Calendar.OpenCalendar then C_Calendar.OpenCalendar() end
  C_Timer.After(1, function() startCalendarScan(true) end)
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
  announce("  /gtloottest drops                       -- ask the game's own loot history what it knows (why no drop IDs?)")
  announce("  /gtloottest checklist [text|reset]      -- the on-screen test checklist (drag it; ticks itself)")
  announce("  /gtloottest check <id>                  -- tick a manual item: app_sync, once, legacy")
  announce("  /gtloottest sync                        -- reload now so Guild Tools gets your loot (also the click-to-sync button that appears after loot)")
  announce("  /gtloottest synctest                    -- pretend another officer synced: your sync button should close")
  announce("  /gtloottest flushtest                   -- try ways to make WoW write WoWChatLog.txt without a reload (four steps, ~65 s)")
  announce("  /gtloottest calendar                    -- read the next 14 days of calendar events and who's coming (saved for Guild Tools)")
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
  elseif arg == "synctest" then
    syncPeerTest()
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
  elseif arg == "drops" then
    showDrops()
  elseif arg == "calendar" then
    calendarCommand()
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
    announceSyncNote()
    if not GuildToolsLootTestDB.checklistHidden then showChecklist() end
  end)
end
