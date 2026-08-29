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
-- NOT TRACKED, deliberately: Greed and Transmog rolls (the guild's 2-win cap is
-- Need-only) -- Transmog turned out to be its own explicitly-labeled roll type in the
-- real chat message, not just a social convention layered on Greed as first assumed;
-- corrected once a real example was seen. Also not tracked: trades between two OTHER
-- players -- Blizzard never broadcasts a trade to anyone but its two participants, so
-- this addon can only ever see a trade if THIS character is one of the two people in
-- it. Full raid-wide trade coverage would need this addon on every raider's client
-- relaying events to each other, which is a separate, bigger build.
--
-- CHAT_MSG_LOOT matching, confirmed live from a real raid's chat log (2026-08-28):
-- Blizzard's actual message is "[Loot]: <name> (<roll type> - <roll value>) Won:
-- <item link>", e.g. "[Loot]: Odasa (Transmogrification - 92) Won: [Spine of the
-- Hissing Abyss]" -- NOT the "<name> wins: <item>" shape this was originally built
-- against from global-string docs (LOOT_ROLL_WON_NEED_S etc.), which is why nothing
-- got captured the first two raid nights. Matching the STRUCTURE (name, then a
-- parenthesized roll type + value, then "Won:") and checking the roll-type word in
-- Lua rather than baking "Need" into the pattern itself -- still a real risk if this
-- exact wording shifts again, but at least now grounded in something actually seen.
--
-- Second, independent capture path: Blizzard's own structured Loot History API
-- (C_LootHistory) -- the same data source their own Loot History UI panel reads from,
-- confirmed against live Blizzard FrameXML source. Enum.EncounterLootDropRollState.
-- NeedMainSpec/NeedOffSpec identify a genuine Need win directly as typed data, no
-- chat wording to get wrong -- meaningfully more robust than text-matching alone.
-- Kept ALONGSIDE the chat parser, not instead of it, as redundancy against either
-- one having a gap; recordNeedWin's own local dedup keeps the two paths from
-- double-counting the same real win on this client.

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

-- "[Loot]: <name> (<roll type> - <roll value>) Won: " -- captures (1) the winner's name
-- and (2) the roll-type word, leaving the item link for extractItemLink() to pull from
-- the same message separately (it carries the full |Hitem:...|h escape sequence, not
-- just the plain bracketed name this pattern's lazy match would stop at).
local WON_ROLL_PATTERN = "%[Loot%]: (.-) %((.-) %- %d+%) Won: "

local function extractItemLink(message)
  return message:match("(|c%x+|Hitem:.-|h|r)")
end

local function itemIdFromLink(link)
  if not link then return nil end
  return tonumber(link:match("item:(%d+)"))
end

-- Blizzard's itemClassID for Recipe -- stable across expansions, the same value every
-- other addon that reads it hardcodes (there's no client-exposed global that names it).
local ITEM_CLASS_RECIPE = 9

-- Toys and recipes ARE Need-rollable in Group Loot, but neither counts toward the
-- guild's 2-win cap -- they're not gear. C_ToyBox.GetToyInfo is the documented way to
-- ask "is this a toy" (returns the itemID back if it is, nil otherwise).
local function isExcludedFromNeedTracking(itemId)
  if not itemId then return false end
  local _, _, _, _, _, itemClassID = GetItemInfoInstant(itemId)
  if itemClassID == ITEM_CLASS_RECIPE then return true end
  if C_ToyBox and C_ToyBox.GetToyInfo and C_ToyBox.GetToyInfo(itemId) then return true end
  return false
end

-- itemEquipLoc is a token (e.g. "INVTYPE_HEAD"), not display text -- _G[token] resolves
-- it to whatever the client's actual localized string is, same pattern
-- patternFromGlobalString uses for chat-message matching. GetItemInfo can return nils on
-- an item that isn't cached yet; by the time a loot roll's outcome reaches chat the
-- client has almost always already cached it (its tooltip had to render), but this falls
-- back rather than blocking if it hasn't.
local function slotLabel(itemLink)
  local _, _, _, _, _, _, _, _, itemEquipLoc = GetItemInfo(itemLink)
  if not itemEquipLoc or itemEquipLoc == "" or itemEquipLoc == "INVTYPE_NON_EQUIP" then return "Other" end
  return _G[itemEquipLoc] or "Other"
end

local function recordNeedWin(winnerName, itemLink, bossOverride)
  if not GuildToolsLootDB.enabled or not winnerName or not itemLink then return end
  local itemId = itemIdFromLink(itemLink)
  if isExcludedFromNeedTracking(itemId) then return end

  -- Local dedup: the chat-text parser and C_LootHistory can both fire for the same
  -- real win on this same client, moments apart -- without this, that inserts two
  -- near-identical records a few seconds apart, which the proxy's exact-time dedup
  -- (itemId+winner+time) wouldn't catch, since the two captures rarely land in the
  -- exact same second.
  local now = time()
  for _, r in ipairs(GuildToolsLootDB.records) do
    if r.itemId == itemId and r.winner == winnerName and math.abs(r.time - now) <= 10 then
      return
    end
  end

  table.insert(GuildToolsLootDB.records, {
    itemId = itemId,
    itemLink = itemLink,
    winner = winnerName,
    boss = bossOverride or currentBoss,
    slot = slotLabel(itemLink),
    time = now,
  })
end

-- Handles LOOT_HISTORY_UPDATE_DROP: looks up the drop's full resolved state and, if
-- the winner's roll was a genuine Need (main-spec or off-spec), records it. Silently
-- no-ops for anything not yet resolved (dropInfo.winner nil), an all-passed drop, or
-- a non-Need winning roll (Transmog/Greed) -- those aren't errors, just not this
-- addon's concern.
local function handleLootHistoryDrop(encounterID, lootListID)
  local dropInfo = C_LootHistory.GetSortedInfoForDrop(encounterID, lootListID)
  if not dropInfo or not dropInfo.winner or not dropInfo.rollInfos then return end

  local winningRoll = nil
  for _, roll in ipairs(dropInfo.rollInfos) do
    if roll.isWinner then
      winningRoll = roll
      break
    end
  end
  if not winningRoll then return end
  if winningRoll.state ~= Enum.EncounterLootDropRollState.NeedMainSpec
    and winningRoll.state ~= Enum.EncounterLootDropRollState.NeedOffSpec then
    return
  end

  -- Resolved from the event's own encounterID, not the closure-tracked currentBoss --
  -- loot can resolve a few seconds after ENCOUNTER_END already cleared it.
  local bossName = currentBoss
  if EJ_GetEncounterInfo then
    local name = EJ_GetEncounterInfo(encounterID)
    if name then bossName = name end
  end

  recordNeedWin(dropInfo.winner.playerName, dropInfo.itemHyperlink, bossName)
end

-- Asks once per raid lockout, not on every loading screen within it (a raid with
-- multiple wings fires PLAYER_ENTERING_WORLD more than once) -- tracked by instanceID,
-- which is stable for one lockout.
local lastPromptedInstanceID = nil

StaticPopupDialogs["GUILDTOOLSLOOT_CONFIRM"] = {
  text = "Log Need-roll loot for this raid in Guild Tools?",
  button1 = "Yes",
  button2 = "Not now",
  OnAccept = function()
    GuildToolsLootDB.enabled = true
    announce("logging Need wins for this raid. /gtloot off any time to stop.")
  end,
  -- Deliberately no OnCancel that touches `enabled`. Blizzard's StaticPopup calls
  -- OnCancel for an explicit button2 click AND for the player just hitting Escape AND
  -- for another popup pre-empting this one (reason: "clicked" for both of the first
  -- two -- genuinely indistinguishable from inside OnCancel; "override" for the third)
  -- -- confirmed against Blizzard's own StaticPopup docs, not assumed. A stray Escape
  -- press or an unrelated popup taking priority must never silently kill a whole
  -- raid's logging with zero real user action. Turning logging OFF is only ever
  -- explicit now, via /gtloot off -- this popup can only ever turn it ON.
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
frame:RegisterEvent("LOOT_HISTORY_UPDATE_DROP")
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
    local winner, rollType = message:match(WON_ROLL_PATTERN)
    if winner and rollType and rollType:lower():find("need") then
      local link = extractItemLink(message)
      if link then recordNeedWin(winner, link) end
    end

  elseif event == "LOOT_HISTORY_UPDATE_DROP" then
    local encounterID, lootListID = ...
    if C_LootHistory and C_LootHistory.GetSortedInfoForDrop then
      handleLootHistoryDrop(encounterID, lootListID)
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
