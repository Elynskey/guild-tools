-- Guild Tools Loot -- logs Need-roll wins (and trades this character is part of) so
-- Guild Tools' desktop app can build a loot history. See the app repo's plan notes for
-- the full design; the short version: this addon only ever writes plain Lua tables to
-- its own SavedVariables and lets WoW's built-in saved-variable persistence handle
-- serialization -- no custom encode/decode logic here, on purpose, since this file
-- can't be tested against a live game client from where it was written. The Electron
-- side does the (testable) work of reading these tables back out.
--
-- On by default (most raid nights are current-tier progression) -- /gtloot off turns
-- logging off for old-content farms, alt runs, or anything else that shouldn't feed
-- the loot history; /gtloot on turns it back on; /gtloot alone reports current state.
-- Announces its current state once at login too, so it's never silently off without
-- you knowing.
--
-- NOT TRACKED, deliberately: Greed and Transmog-intent-Greed rolls (the guild's 2-win
-- cap is Need-only, so Greed doesn't matter here), and trades between two OTHER
-- players -- Blizzard never broadcasts a trade to anyone but its two participants, so
-- this addon can only ever see a trade if THIS character is one of the two people in
-- it. Full raid-wide trade coverage would need this addon on every raider's client
-- relaying events to each other, which is a separate, bigger build.
--
-- HIGHEST-RISK PART OF THIS FILE: the exact global-string names Blizzard uses for the
-- "so-and-so wins: [item]" chat message have shifted across expansions historically.
-- This reads them from _G (so it doesn't hardcode English text and adapts to whatever
-- the client's actual patterns are) with a couple of known fallback names, but this is
-- the first thing to check if a real raid-night test shows missed Need wins.

local ADDON_NAME = ...

GuildToolsLootDB = GuildToolsLootDB or {}
GuildToolsLootDB.records = GuildToolsLootDB.records or {}
GuildToolsLootDB.trades = GuildToolsLootDB.trades or {}
-- Defaults ON, since most raid nights are current-tier progression -- toggle off with
-- /gtloot for old-content farm runs, alt runs, or anything else that shouldn't count
-- toward the loot history.
if GuildToolsLootDB.enabled == nil then GuildToolsLootDB.enabled = true end

local function announce(msg)
  DEFAULT_CHAT_FRAME:AddMessage('|cffd4b358Guild Tools Loot:|r ' .. msg)
end

local currentBoss = nil

-- rollID -> { link = itemLink, name = itemName }, populated on START_LOOT_ROLL, read
-- when that roll's outcome is announced in chat, then cleared.
local pendingRolls = {}

local function playerRealmName()
  local name, realm = UnitFullName("player")
  if not realm or realm == "" then realm = GetRealmName() end
  return name, realm
end

-- Builds a Lua pattern from a Blizzard global string, escaping magic characters and
-- turning each %s into a capture group -- so this matches whatever the client's actual
-- localized text is instead of a hardcoded English guess. Returns nil if the global
-- string doesn't exist on this client (older/newer patch, name changed) rather than
-- erroring -- callers just skip that pattern.
local function patternFromGlobalString(key)
  local raw = _G[key]
  if not raw or raw == "" then return nil end
  local escaped = raw:gsub("([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
  escaped = escaped:gsub("%%%%s", "(.+)")
  return escaped
end

-- Known-across-expansions candidates for "<player> wins: <item>. (Need)" -- kept as a
-- list, not a single guess, and built once at load rather than per-message.
local NEED_WIN_PATTERNS = {}
for _, key in ipairs({ "LOOT_ROLL_WON_NEED_S", "LOOT_ROLL_WON_S", "LOOT_ROLL_WON" }) do
  local p = patternFromGlobalString(key)
  if p then table.insert(NEED_WIN_PATTERNS, p) end
end

local function extractItemLink(message)
  return message:match("(|c%x+|Hitem:.-|h|r)")
end

local function itemIdFromLink(link)
  if not link then return nil end
  return tonumber(link:match("item:(%d+)"))
end

local function recordNeedWin(winnerName, itemLink)
  if not GuildToolsLootDB.enabled or not winnerName or not itemLink then return end
  table.insert(GuildToolsLootDB.records, {
    itemId = itemIdFromLink(itemLink),
    itemLink = itemLink,
    winner = winnerName,
    boss = currentBoss,
    time = time(),
  })
end

-- Asks once per raid lockout, not on every loading screen within it (a raid with
-- multiple wings fires PLAYER_ENTERING_WORLD more than once) -- tracked by instanceID,
-- which is stable for one lockout.
local lastPromptedInstanceID = nil

StaticPopupDialogs["GUILDTOOLSLOOT_CONFIRM"] = {
  text = "Log Need-roll loot for this raid in Guild Tools?",
  button1 = "Yes",
  button2 = "No",
  OnAccept = function()
    GuildToolsLootDB.enabled = true
    announce("logging Need wins for this raid. /gtloot off any time to stop.")
  end,
  OnCancel = function()
    GuildToolsLootDB.enabled = false
    announce("not logging this raid. /gtloot on any time to turn it back on.")
  end,
  timeout = 0,
  whileDead = true,
  hideOnEscape = true,
  preferredIndex = 3,
}

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("ENCOUNTER_START")
frame:RegisterEvent("ENCOUNTER_END")
frame:RegisterEvent("START_LOOT_ROLL")
frame:RegisterEvent("CHAT_MSG_LOOT")
frame:RegisterEvent("TRADE_SHOW")
frame:RegisterEvent("TRADE_ACCEPT_UPDATE")
frame:RegisterEvent("TRADE_CLOSED")

local tradeTargetName = nil
-- [1..6] player-side trade slots -> item link, captured as the trade window updates.
local tradePlayerItems = {}
local tradeCompleted = false

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    if GuildToolsLootDB.enabled then
      announce('logging Need wins (type /gtloot off to stop for this run).')
    else
      announce('NOT logging (type /gtloot on to resume).')
    end

  elseif event == "PLAYER_ENTERING_WORLD" then
    local inInstance, instanceType = IsInInstance()
    if inInstance and instanceType == "raid" then
      local _, _, _, _, _, _, _, instanceID = GetInstanceInfo()
      if instanceID and instanceID ~= lastPromptedInstanceID then
        lastPromptedInstanceID = instanceID
        StaticPopup_Show("GUILDTOOLSLOOT_CONFIRM")
      end
    end

  elseif event == "ENCOUNTER_START" then
    local _, encounterName = ...
    currentBoss = encounterName

  elseif event == "ENCOUNTER_END" then
    currentBoss = nil

  elseif event == "START_LOOT_ROLL" then
    local rollID = ...
    if GetLootRollItemLink then
      local link = GetLootRollItemLink(rollID)
      if link then pendingRolls[rollID] = { link = link } end
    end

  elseif event == "CHAT_MSG_LOOT" then
    local message = ...
    for _, pattern in ipairs(NEED_WIN_PATTERNS) do
      local winner, itemText = message:match(pattern)
      if winner then
        local link = extractItemLink(message) or extractItemLink(itemText or "")
        if link then recordNeedWin(winner, link) end
        break
      end
    end

  elseif event == "TRADE_SHOW" then
    -- The trade partner's name reliably comes from the trade frame's own recipient
    -- text, not the "target" unit -- the trade may have been opened via right-click on
    -- a raid frame/chat name rather than by targeting them first.
    tradeTargetName = TradeFrameRecipientNameText and TradeFrameRecipientNameText:GetText()
    tradePlayerItems = {}
    tradeCompleted = false

  elseif event == "TRADE_ACCEPT_UPDATE" then
    -- Snapshot what's currently offered on the player's side of the trade window --
    -- both sides accepting is what TRADE_CLOSED-after-acceptance actually means, so
    -- this just keeps the latest offered items in case the trade completes.
    for slot = 1, 6 do
      if GetTradePlayerItemLink then
        local link = GetTradePlayerItemLink(slot)
        if link then tradePlayerItems[slot] = link end
      end
    end
    tradeCompleted = true

  elseif event == "TRADE_CLOSED" then
    if GuildToolsLootDB.enabled and tradeCompleted and tradeTargetName then
      local myName = playerRealmName()
      for _, link in pairs(tradePlayerItems) do
        table.insert(GuildToolsLootDB.trades, {
          itemId = itemIdFromLink(link),
          itemLink = link,
          from = myName,
          to = tradeTargetName,
          time = time(),
        })
      end
    end
    tradeTargetName = nil
    tradePlayerItems = {}
    tradeCompleted = false
  end
end)

SLASH_GUILDTOOLSLOOT1 = "/gtloot"
SlashCmdList["GUILDTOOLSLOOT"] = function(msg)
  local arg = (msg or ""):lower():match("^%s*(%S*)")
  if arg == "on" then
    GuildToolsLootDB.enabled = true
    announce("logging Need wins.")
  elseif arg == "off" then
    GuildToolsLootDB.enabled = false
    announce("NOT logging -- use this for old-content or off-progression runs. /gtloot on to resume.")
  else
    announce((GuildToolsLootDB.enabled and "currently logging Need wins." or "currently NOT logging.") .. " /gtloot on|off to change.")
  end
end
