-- Guild Tools Loot -- logs Need-roll wins (and trades this character is part of) so
-- Guild Tools' desktop app can build a loot history. See the app repo's plan notes for
-- the full design; the short version: this addon only ever writes plain Lua tables to
-- its own SavedVariables and lets WoW's built-in saved-variable persistence handle
-- serialization -- no custom encode/decode logic here, on purpose, since this file
-- can't be tested against a live game client from where it was written. The Electron
-- side does the (testable) work of reading these tables back out.
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
  if not winnerName or not itemLink then return end
  table.insert(GuildToolsLootDB.records, {
    itemId = itemIdFromLink(itemLink),
    itemLink = itemLink,
    winner = winnerName,
    boss = currentBoss,
    time = time(),
  })
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
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
    -- Nothing to do -- SavedVariables are already loaded by this point; this just
    -- confirms the addon initialized. Left as a hook point for a future status line.

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
    if tradeCompleted and tradeTargetName then
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
