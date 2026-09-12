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
--
-- scanLootHistory() (the backfill/rescan, triggered after each kill and via
-- /gtloot scan) does NOT use C_LootHistory.GetAllEncounterInfos() to find which
-- encounters to check -- confirmed live 2026-08-28 that it only surfaces a narrow
-- recent window, not the whole raid (a manual /gtloot scan run after several kills
-- only picked up the most recent boss). Walks GuildToolsLootDB.seenEncounters (this
-- addon's own record of every encounterID it's seen via ENCOUNTER_START this raid)
-- instead, which C_LootHistory.GetSortedDropsForEncounter() still answers correctly
-- for even once GetAllEncounterInfos() has "forgotten" that encounter.

local ADDON_NAME = ...

-- Re-asserts every SavedVariables field is the right type, called at the top of every
-- event/slash-command entry point rather than trusted once at file load. A live report
-- showed GuildToolsLootDB.seenEncounters was nil at the point scanLootHistory() read it
-- despite the equivalent one-time init below having already run earlier in the same
-- load -- never fully explained (should be structurally impossible for a global table
-- field to un-set itself between top-level file execution and a later function call),
-- but re-asserting defensively at every real entry point costs nothing and closes the
-- whole class of "assumed a table, got nil" surprises regardless of root cause.
local function ensureDB()
  GuildToolsLootDB = GuildToolsLootDB or {}
  GuildToolsLootDB.records = GuildToolsLootDB.records or {}
  GuildToolsLootDB.trades = GuildToolsLootDB.trades or {}
  -- encounterID (as a string key) -> encounterName, for every encounter THIS character
  -- has personally seen this raid -- scanLootHistory() walks this instead of trusting
  -- C_LootHistory.GetAllEncounterInfos() to remember the whole raid, which it doesn't
  -- (confirmed live 2026-08-28: a manual /gtloot scan run after several kills only
  -- picked up the most recent boss). Persisted, not just in-memory, so it survives a
  -- /reload mid-raid.
  GuildToolsLootDB.seenEncounters = GuildToolsLootDB.seenEncounters or {}
  -- Need rolls that did NOT win -- see recordNeedLoss. Deliberately separate from
  -- `records` (which stays wins-only, unchanged) rather than folding losses in with a
  -- flag, so the well-tested win-tracking path can't regress from this addition.
  GuildToolsLootDB.needLosses = GuildToolsLootDB.needLosses or {}
  -- Defaults ON, since most raid nights are current-tier progression -- toggle off with
  -- /gtloot for old-content farm runs, alt runs, or anything else that shouldn't count
  -- toward the loot history.
  if GuildToolsLootDB.enabled == nil then GuildToolsLootDB.enabled = true end
end

ensureDB()

local function announce(msg)
  DEFAULT_CHAT_FRAME:AddMessage('|cffd4b358Guild Tools Loot:|r ' .. msg)
end

-- Confirmed live 2026-09-12: an officer had this addon capturing wins correctly (the
-- in-game "Need win captured" announcement fired every time) but Guild Tools never
-- updated live -- because the app's live-loot path doesn't read anything this addon
-- writes at all. It tails WoW's own chat LOG FILE on disk instead (continuous, unlike
-- SavedVariables), which Blizzard's client only writes if chat logging is turned on
-- via /chatlog -- a one-time, easy-to-forget setting with no in-game indicator of its
-- own. IsChatLogging() is the same check the default UI's own "Log all chat" option
-- reads, guarded like every other less-than-certain API in this file.
--
-- IsChatLogging() itself isn't fully trustworthy either -- confirmed live 2026-09-12,
-- same day: it read OFF for an officer who had chat logging genuinely on. Root cause
-- unconfirmed (possibly a CVar that hasn't settled yet at the moment this happens to be
-- called). Two mitigations, not a real fix (there's no file access from in-game Lua to
-- verify against directly):
--   1. Once a true reading is ever seen this session, remembered -- a later false
--      reading is reported as "reads off, but was on earlier" rather than a flat
--      contradiction of something the officer already confirmed with their own eyes.
--   2. /gtloot's on-demand check (not this passive reminder) samples twice, a beat
--      apart, before reporting -- cheap insurance against a one-off transient read.
local chatLoggingSeenOnThisSession = false

local function chatLoggingStatusLine()
  if not IsChatLogging then return 'unavailable on this client', nil end
  local isOn = IsChatLogging()
  if isOn then
    chatLoggingSeenOnThisSession = true
    return 'ON', true
  end
  if chatLoggingSeenOnThisSession then
    return 'reads OFF right now, but was ON earlier this session -- possibly a stale read; check Interface Options if unsure', false
  end
  return 'OFF', false
end

-- Only announced at login and raid-entry (not on every event) -- the setting
-- essentially never flips mid-session, so more than that would just be noise. A
-- separate, narrower warning fires at actual capture time instead (see recordNeedWin).
local function remindChatLoggingIfOff()
  local line, isOn = chatLoggingStatusLine()
  if isOn == false then
    announce('chat logging ' .. line .. ' -- Guild Tools needs it for live loot updates. Type /chatlog once, THEN FULLY LOG OUT (not just /reload) -- confirmed live: it only starts actually writing after a real login, not mid-session.')
  end
end

local currentBoss = nil
-- Mirrors currentBoss's "don't clear on ENCOUNTER_END" lifecycle (see that ENCOUNTER_END
-- handler's own comment) -- loot resolves after the kill, so this needs to still be the
-- just-killed encounter's ID when a win/loss actually gets recorded. Used by
-- isTrackedEncounter for the chat-text capture path, which has no encounterID of its own.
local currentEncounterID = nil

-- Same lifecycle as currentBoss/currentEncounterID -- captured once at ENCOUNTER_START
-- (while definitely still inside the raid instance) rather than re-derived at record
-- time, since a delayed backfill scan or a chat message arriving after the kill could
-- otherwise read stale/wrong instance info if the player has already zoned elsewhere.
-- nil for the Nymrissa Wavecaller Lair exception (a Delve, not a raid difficulty at all).
local currentDifficulty = nil

-- Generation counter + "captured in generation N" marker, NOT a single shared boolean
-- that gets reset at the next ENCOUNTER_START -- a real live bug (2026-09-12): the
-- ENCOUNTER_END reminder below waits 20s before checking whether anything was
-- captured, and if the raid pulls the next boss within that window (fast trash, a
-- quick repull), the next ENCOUNTER_START reset the shared flag to false right out
-- from under the still-pending timer, so a real capture silently never got its
-- reminder. Each encounter gets its own generation number instead; recordNeedWin
-- stamps the CURRENT generation when it captures something, and the timer (which
-- closed over the generation number AT THE MOMENT IT ENDED) only announces if that
-- exact generation is the one that got stamped -- immune to how many new encounters
-- have started by the time the 20s is up.
local encounterGeneration = 0
local capturedInGeneration = nil

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

-- Blizzard's itemClassID for Recipe, and itemClassID/itemSubClassID for Companion Pets
-- -- stable across expansions, the same values every other addon that reads them
-- hardcodes (there's no client-exposed global that names them). Confirmed against
-- Warcraft Wiki's item-type table, not guessed.
local ITEM_CLASS_RECIPE = 9
local ITEM_CLASS_MISCELLANEOUS = 15
local ITEM_SUBCLASS_COMPANION_PET = 2

-- Toys, recipes, and companion pets ARE Need-rollable in Group Loot, but none of them
-- count toward the guild's 2-win cap -- they're not gear (confirmed live 2026-08-28: a
-- real companion pet, Soulcoil Remnant, got captured before this check existed).
-- C_ToyBox.GetToyInfo is the documented way to ask "is this a toy" (returns the itemID
-- back if it is, nil otherwise).
local function isExcludedFromNeedTracking(itemId)
  if not itemId then return false end
  local _, _, _, _, _, itemClassID, itemSubClassID = GetItemInfoInstant(itemId)
  if itemClassID == ITEM_CLASS_RECIPE then return true end
  if itemClassID == ITEM_CLASS_MISCELLANEOUS and itemSubClassID == ITEM_SUBCLASS_COMPANION_PET then return true end
  if C_ToyBox and C_ToyBox.GetToyInfo and C_ToyBox.GetToyInfo(itemId) then return true end
  return false
end

-- Blizzard's raid difficulty IDs (Enum.RaidDifficultyID, stable since Legion's 7.0
-- difficulty rework): 14 Normal, 15 Heroic, 16 Mythic, 17 LFR (Raid Finder). NOT the
-- same numbering as Warcraft Logs' own difficulty field elsewhere in this app (WCL
-- uses 3/4/5 for the same three progression difficulties) -- this addon reads
-- Blizzard's raw client API directly, a separate namespace. Sourced from Blizzard's
-- documented DifficultyID list, not a live client read -- same caveat as everywhere
-- else in this file that can't be tested against a real client from here.
--
-- Deliberately Normal/Heroic ONLY -- this guild doesn't run Mythic, and a data-audit
-- found loot attributed to raid nights that don't match the guild's real Wed(LFR)/
-- Fri(Alt)/Sat(Heroic) schedule, with no way to tell which difficulty it actually came
-- from since nothing recorded it (see DIFFICULTY_LABEL below, added to close that
-- gap). Narrowing this list is belt-and-suspenders against Mythic specifically; it was
-- never actually the suspected leak (LFR was), but there's no reason to track a
-- difficulty this guild doesn't run.
local DIFFICULTY_LABEL = { [14] = "Normal", [15] = "Heroic" }

-- The guild's current tier's raid, by its real in-game display name (matches
-- src/config.ts's tier.name in the companion app -- keep these two in sync). Added
-- after loot kept getting captured from Normal/Heroic runs of raids that AREN'T this
-- tier's designated one (an old-tier farm/alt clear, or helping out in someone else's
-- raid) -- difficulty alone (below) only ever excluded LFR/Mythic, not "the right
-- difficulty, wrong raid." GetInstanceInfo()'s name is the real client-localized
-- string, not a guessed numeric instanceID -- update this one line at the start of
-- each new tier.
local TRACKED_RAID_NAME = "The Venomous Abyss"

-- Only Normal/Heroic loot from THIS tier's designated raid counts -- Raid Finder,
-- Mythic, any other raid, and anything that isn't a raid at all are excluded. Checked
-- live at the moment of each win, not just at the PLAYER_ENTERING_WORLD popup below:
-- GuildToolsLootDB.enabled can already be true from an earlier tracked raid this
-- session, and would otherwise keep capturing into an untracked run walked into
-- afterward with no fresh prompt to decline.
local function currentRaidDifficultyLabel()
  local inInstance, instanceType = IsInInstance()
  if not inInstance or instanceType ~= "raid" then return nil end
  local name, _, difficultyID = GetInstanceInfo()
  if name ~= TRACKED_RAID_NAME then return nil end
  return DIFFICULTY_LABEL[difficultyID]
end

local function isTrackedRaidDifficulty()
  return currentRaidDifficultyLabel() ~= nil
end

-- One deliberate exception to raid-only tracking: Nymrissa Wavecaller's Lair -- a
-- bonus/superboss fought through a Delve, which reports instanceType "scenario" to
-- IsInInstance(), not "raid", so isTrackedRaidDifficulty() alone would always exclude
-- it. encounterID 3379 confirmed against this guild's own real Warcraft Logs report
-- (hPLmXKyz4Vn3tZHr, 2026-09-05) rather than guessed -- the same numeric ID both WCL
-- and this addon's own ENCOUNTER_START event key off, more robust than matching the
-- display name as a string. Deliberately narrow: ordinary Delves (any other scenario)
-- stay excluded entirely, on purpose -- only this specific Lair counts.
local TRACKED_LAIR_ENCOUNTER_IDS = { [3379] = true }

local function isTrackedEncounter(encounterID)
  if isTrackedRaidDifficulty() then return true end
  local inInstance, instanceType = IsInInstance()
  return inInstance and instanceType == "scenario" and TRACKED_LAIR_ENCOUNTER_IDS[encounterID] == true
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
  -- Lua's `or` only falls through on nil/false -- an empty string from _G[itemEquipLoc]
  -- (confirmed live 2026-08-28: happened for a real item) is truthy and would otherwise
  -- slip through as a blank slot instead of "Other".
  local resolved = _G[itemEquipLoc]
  if not resolved or resolved == "" then return "Other" end
  return resolved
end

local function recordNeedWin(winnerName, itemLink, bossOverride, encounterIDOverride, difficultyOverride)
  if not GuildToolsLootDB.enabled or not winnerName or not itemLink then return end
  if not isTrackedEncounter(encounterIDOverride or currentEncounterID) then return end
  local itemId = itemIdFromLink(itemLink)
  if isExcludedFromNeedTracking(itemId) then return end

  -- Local dedup: the chat-text parser, C_LootHistory's live event, AND
  -- scanLootHistory()'s backfill can all independently (re-)discover the same real win
  -- -- without this, that inserts a fresh near-duplicate record every time, stamped
  -- with whatever "now" happens to be at capture time (not the roll's actual time,
  -- which C_LootHistory doesn't expose). A 10-second window only caught the
  -- live-event-vs-chat-text case; it completely missed a LATER rescan re-surfacing an
  -- OLDER win (confirmed live 2026-08-28: a scan run over an hour after the original
  -- captures re-inserted all of them as "new"). 6 hours matches this app's own
  -- same-raid-night grouping threshold (see groupLootByNight in lootLogic.ts) --
  -- generous enough to cover any realistic rescan within one raid night, while still
  -- letting a genuinely new win of the same item on a LATER night through.
  local now = time()
  local DEDUP_WINDOW_SECONDS = 6 * 60 * 60
  for _, r in ipairs(GuildToolsLootDB.records) do
    if r.itemId == itemId and r.winner == winnerName and math.abs(r.time - now) <= DEDUP_WINDOW_SECONDS then
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
    difficulty = difficultyOverride or currentDifficulty,
  })
  capturedInGeneration = encounterGeneration

  -- Real-time confirmation that a win actually got captured -- itemLink is the real
  -- escape-coded link, so this renders as a normal clickable/hoverable item in chat,
  -- not plain text. Tied directly to the moment it matters: if chat logging reads off
  -- right now, THIS capture won't reach Guild Tools live either, so the warning lands
  -- on the exact win it affects instead of only at login/raid-entry.
  local _, chatLoggingOn = chatLoggingStatusLine()
  local warning = chatLoggingOn == false and ' |cffa83232(chat logging is off -- won\'t show up live, only after a reload)|r' or ''
  announce(winnerName .. "'s Need win captured: " .. itemLink .. warning)
end

-- Records a Need roll that did NOT win -- who's rolling and not winning, as opposed to
-- who's simply not rolling (outgrown gear, off-spec drop, etc.), which stays invisible
-- same as today. Deliberately silent (no chat announce, unlike recordNeedWin) -- this
-- is officer-app-only, never posted anywhere raid-visible; calling out someone's bad
-- roll live in raid chat would be a jerk move this addon shouldn't enable.
local function recordNeedLoss(loserName, itemLink, bossOverride, encounterIDOverride, difficultyOverride)
  if not GuildToolsLootDB.enabled or not loserName or not itemLink then return end
  if not isTrackedEncounter(encounterIDOverride or currentEncounterID) then return end
  local itemId = itemIdFromLink(itemLink)
  if isExcludedFromNeedTracking(itemId) then return end

  -- Same dedup rationale as recordNeedWin -- a rescan re-surfacing an older loss must
  -- not re-insert it. 6-hour window matches recordNeedWin and this app's own
  -- same-raid-night grouping threshold.
  local now = time()
  local DEDUP_WINDOW_SECONDS = 6 * 60 * 60
  for _, r in ipairs(GuildToolsLootDB.needLosses) do
    if r.itemId == itemId and r.name == loserName and math.abs(r.time - now) <= DEDUP_WINDOW_SECONDS then
      return
    end
  end

  table.insert(GuildToolsLootDB.needLosses, {
    itemId = itemId,
    itemLink = itemLink,
    name = loserName,
    boss = bossOverride or currentBoss,
    slot = slotLabel(itemLink),
    time = now,
    difficulty = difficultyOverride or currentDifficulty,
  })
end

-- Resolved once at load, not re-indexed per call. Guarded rather than assumed --
-- sourced from research, not a live client read, and confirmed live 2026-08-28 that an
-- unguarded index into this exact path crashes scanLootHistory() partway through (the
-- "Scanning now..." message shows, then nothing else ever does -- WoW hides the error).
-- If this enum path turns out to be wrong/missing on the real client, these just stay
-- nil, and the comparison below below never matches -- the C_LootHistory path quietly
-- captures nothing instead of crashing, falling back to the chat-text path alone.
local NEED_MAIN_SPEC_STATE = Enum and Enum.EncounterLootDropRollState and Enum.EncounterLootDropRollState.NeedMainSpec
local NEED_OFF_SPEC_STATE = Enum and Enum.EncounterLootDropRollState and Enum.EncounterLootDropRollState.NeedOffSpec

-- Handles LOOT_HISTORY_UPDATE_DROP: looks up the drop's full resolved state and, if
-- the winner's roll was a genuine Need (main-spec or off-spec), records it -- and, for
-- everyone else on the SAME drop who also Need-rolled but didn't win, records a loss
-- for each of them too (see recordNeedLoss). Silently no-ops for anything not yet
-- resolved (dropInfo.winner nil), an all-passed drop, or a non-Need winning roll
-- (Transmog/Greed) -- those aren't errors, just not this addon's concern.
--
-- rollInfos entry shape (playerName, state, isWinner, roll) confirmed against Warcraft
-- Wiki's documented EncounterLootDropRollInfo, not yet against a live client -- same
-- "unverified until next raid night" caveat as everything else in this file that reads
-- undocumented-in-game Blizzard structures.
local function handleLootHistoryDrop(encounterID, lootListID, bossNameHint)
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
  if winningRoll.state ~= NEED_MAIN_SPEC_STATE and winningRoll.state ~= NEED_OFF_SPEC_STATE then
    return
  end

  -- Prefers a name passed in by the caller (scanLootHistory already has it from
  -- GetAllEncounterInfos) over re-deriving one -- falls back to the event's own
  -- encounterID via EJ_GetEncounterInfo, then the closure-tracked currentBoss, since
  -- loot can resolve a few seconds after ENCOUNTER_END already cleared that.
  local bossName = bossNameHint or currentBoss
  if not bossNameHint and EJ_GetEncounterInfo then
    local name = EJ_GetEncounterInfo(encounterID)
    if name then bossName = name end
  end

  recordNeedWin(dropInfo.winner.playerName, dropInfo.itemHyperlink, bossName, encounterID)

  for _, roll in ipairs(dropInfo.rollInfos) do
    if not roll.isWinner and (roll.state == NEED_MAIN_SPEC_STATE or roll.state == NEED_OFF_SPEC_STATE) then
      recordNeedLoss(roll.playerName, dropInfo.itemHyperlink, bossName, encounterID)
    end
  end
end

-- Backfill: re-walks EVERY encounter/drop C_LootHistory currently knows about (not
-- just whatever the last live event happened to cover) and records any Need win not
-- already captured -- recordNeedWin's own dedup makes re-scanning the same data
-- repeatedly safe, so this can run as often as useful. Triggered automatically after
-- each kill (ENCOUNTER_END) and manually via /gtloot scan, for exactly the case the
-- live LOOT_HISTORY_UPDATE_DROP event might miss (e.g. this addon loaded after the
-- event already fired, or the event just didn't reach a background frame).
local function scanLootHistory()
  if not C_LootHistory or not C_LootHistory.GetSortedDropsForEncounter then return 0 end
  local found = #GuildToolsLootDB.records

  -- Wrapped in pcall -- this has silently crashed partway through twice already
  -- (confirmed live 2026-08-28, two different root causes, both invisible since WoW
  -- hides Lua errors by default). Rather than guess at a third unguarded spot, this
  -- surfaces the real error text in chat if it happens again, instead of just quietly
  -- stopping.
  local ok, err = pcall(function()
    -- Union of both sources -- seenEncounters (this addon's own tracking, reliable
    -- going forward but only knows about encounters since this code started running)
    -- AND Blizzard's own GetAllEncounterInfos() (unreliable for a full raid on its
    -- own, but may still remember recent bosses this addon never saw ENCOUNTER_START
    -- for -- e.g. ones killed before a /reload picked up this code).
    local toScan = {}
    for encounterIDStr, encounterName in pairs(GuildToolsLootDB.seenEncounters) do
      local id = tonumber(encounterIDStr)
      if id then toScan[id] = encounterName end
    end
    if C_LootHistory.GetAllEncounterInfos then
      for _, encounter in ipairs(C_LootHistory.GetAllEncounterInfos() or {}) do
        if not toScan[encounter.encounterID] then toScan[encounter.encounterID] = encounter.encounterName end
      end
    end

    for encounterID, encounterName in pairs(toScan) do
      local drops = C_LootHistory.GetSortedDropsForEncounter(encounterID)
      for _, drop in ipairs(drops or {}) do
        handleLootHistoryDrop(encounterID, drop.lootListID, encounterName)
      end
    end
  end)

  if not ok then
    announce("Scan error (send this to Ethan): " .. tostring(err))
  end

  return #GuildToolsLootDB.records - found
end

-- Asks once per raid lockout, not on every loading screen within it (a raid with
-- multiple wings fires PLAYER_ENTERING_WORLD more than once) -- tracked by instanceID,
-- which is stable for one lockout.
local lastPromptedInstanceID = nil

StaticPopupDialogs["GUILDTOOLSLOOT_CONFIRM"] = {
  text = "Log Need-roll loot for this raid in Guild Tools?",
  button1 = "Yes",
  button2 = "Not now",
  -- A raid-entry popup with no sound is easy to miss entirely (tabbed out, loading
  -- screen just ended, chat spam) -- READY_CHECK is the closest existing Blizzard
  -- sound kit to "a raid-wide prompt just appeared, please respond," and is already
  -- a sound every raider recognizes instantly. OnShow rather than firing this next to
  -- StaticPopup_Show() below, so it only ever plays at the moment the popup actually
  -- becomes visible (never if Blizzard's own queueing defers it).
  OnShow = function()
    if SOUNDKIT and SOUNDKIT.READY_CHECK then PlaySound(SOUNDKIT.READY_CHECK) end
  end,
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

-- A real popup instead of a chat line -- confirmed live twice now (2026-09-11,
-- 2026-09-12) that whether /chatlog is actually on is exactly the thing officers get
-- wrong without noticing, and a chat message scrolls away/gets missed in raid spam.
-- /gtloot with no argument (the "just checking" case) shows this instead of only
-- printing to chat; /gtloot on|off|scan stay chat-only since those are already
-- confirming an action the player just took, not something they need to go verify.
-- Samples IsChatLogging() twice, ~0.5s apart, before this on-demand check reports --
-- cheap insurance against the one-off transient false read confirmed live 2026-09-12
-- (an officer had chat logging genuinely on and this read it as off). Not a fix for a
-- wrong reading that persists across both samples -- there's no way to check the
-- actual log file from in-game Lua -- just narrows the window a truly transient hiccup
-- could land in. Only used here, not in the passive login/raid-entry reminder or the
-- capture-time warning -- those fire automatically and shouldn't add a delay.
local function sampleChatLogging(callback)
  if not IsChatLogging then
    callback(nil)
    return
  end
  if IsChatLogging() then
    chatLoggingSeenOnThisSession = true
    callback(true)
    return
  end
  C_Timer.After(0.5, function()
    local second = IsChatLogging()
    if second then chatLoggingSeenOnThisSession = true end
    callback(second)
  end)
end

-- chatLoggingResult is true/false/nil, already resolved by sampleChatLogging above --
-- kept as a plain parameter (not re-sampled in here) so this stays synchronous and
-- StaticPopup_Show can be called directly from the sampleChatLogging callback.
local function buildStatusText(chatLoggingResult)
  local logging = GuildToolsLootDB.enabled and "|cff5f9e4aLogging Need wins|r" or "|cffa83232NOT logging|r (old content/alt run?)"
  local chatLogging
  if chatLoggingResult == nil then
    chatLogging = "Chat logging status unavailable on this client"
  elseif chatLoggingResult == true then
    chatLogging = "|cff5f9e4aChat logging is ON|r -- live updates will reach Guild Tools"
  elseif chatLoggingSeenOnThisSession then
    chatLogging = "|cffc0902fReads OFF right now, but was ON earlier this session|r -- possibly a stale read. Trust Interface Options if it disagrees."
  else
    chatLogging = "|cffa83232Chat logging is OFF|r -- type /chatlog once, THEN FULLY LOG OUT (not /reload) to make it stick"
  end
  return logging .. "\n" .. chatLogging .. "\n\n/gtloot on|off to change -- /gtloot scan to pull in anything missed"
end

StaticPopupDialogs["GUILDTOOLSLOOT_STATUS"] = {
  text = "%s",
  button1 = "OK",
  timeout = 0,
  whileDead = true,
  hideOnEscape = true,
}

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("ENCOUNTER_START")
frame:RegisterEvent("ENCOUNTER_END")
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
  ensureDB()
  if event == "PLAYER_LOGIN" then
    if GuildToolsLootDB.enabled then
      announce('logging Need wins (type /gtloot off to stop for this run).')
    else
      announce('NOT logging (type /gtloot on to resume).')
    end
    remindChatLoggingIfOff()

  elseif event == "PLAYER_ENTERING_WORLD" then
    -- Never prompts for Raid Finder -- recordNeedWin's own isTrackedRaidDifficulty()
    -- check would block it from logging anyway even if answered "Yes", but asking at
    -- all for a difficulty that can never actually log invites exactly the confusion
    -- that prompted this check in the first place.
    if isTrackedRaidDifficulty() then
      local _, _, _, _, _, _, _, instanceID = GetInstanceInfo()
      if instanceID and instanceID ~= lastPromptedInstanceID then
        lastPromptedInstanceID = instanceID
        StaticPopup_Show("GUILDTOOLSLOOT_CONFIRM")
        remindChatLoggingIfOff()
      end
    end

  elseif event == "ENCOUNTER_START" then
    local encounterID, encounterName = ...
    currentBoss = encounterName
    currentEncounterID = encounterID
    currentDifficulty = currentRaidDifficultyLabel()
    encounterGeneration = encounterGeneration + 1
    if encounterID then
      GuildToolsLootDB.seenEncounters[tostring(encounterID)] = encounterName
    end

  elseif event == "ENCOUNTER_END" then
    -- Deliberately NOT clearing currentBoss here (it used to be nilled out on every
    -- ENCOUNTER_END). Need-roll results post to chat well after the kill -- by the
    -- time CHAT_MSG_LOOT's "Won:" message fires, ENCOUNTER_END has essentially always
    -- already happened, so every chat-text-captured record was getting boss = nil
    -- (confirmed live 2026-08-28: all 5 real captures that night had no boss at all).
    -- currentBoss now just holds "whichever encounter's ENCOUNTER_START fired most
    -- recently" until the next one overwrites it -- correct for the loot-resolution
    -- window, and there's nothing else between one kill's loot settling and the next
    -- pull's ENCOUNTER_START that would misattribute it to the wrong boss.
    if C_Timer then
      -- Need rolls take a little while to resolve after the kill -- delayed rather
      -- than immediate so this doesn't scan before the last roll has actually settled.
      -- thisGeneration is captured NOW, by value, into the closure -- if the raid
      -- pulls the next boss (or several) before this fires, encounterGeneration keeps
      -- incrementing, but thisGeneration stays fixed at what THIS kill's ENCOUNTER_END
      -- saw, so the comparison below stays correct regardless of what's happened since.
      local thisGeneration = encounterGeneration
      C_Timer.After(20, function()
        scanLootHistory()
        -- Guild Tools also tails the live chat log now, so a win already shows up
        -- there within seconds -- SavedVariables (this data) still only flush to disk
        -- on reload/logout, but that's now just what fills in the real boss/slot on an
        -- already-visible entry, not the only way it reaches the app at all. Only
        -- fires when THIS kill actually produced a win, so a trash-only reset or a
        -- boss nobody needed on stays silent.
        if capturedInGeneration == thisGeneration then
          announce("Loot captured -- it'll show up live in Guild Tools; /reload whenever's convenient to confirm the boss/slot.")
        end
      end)
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
    -- Snapshot what's currently offered on the player's side of the trade window.
    for slot = 1, 6 do
      if GetTradePlayerItemLink then
        local link = GetTradePlayerItemLink(slot)
        if link then tradePlayerItems[slot] = link end
      end
    end
    -- This event fires on ANY accept-state change -- either side accepting OR
    -- un-accepting -- not just the final completion. Unconditionally setting this true
    -- (the old behavior) meant one side accepting, then the OTHER cancelling the trade
    -- instead of also accepting, still fired TRADE_CLOSED with tradeCompleted stuck
    -- true from that single accept -- logging a trade that never actually happened.
    -- Tracking both sides' current accept state instead means TRADE_CLOSED only ever
    -- sees true if the trade was genuinely still fully accepted the moment it closed.
    local playerAccepted, targetAccepted = ...
    tradeCompleted = playerAccepted and targetAccepted

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
  ensureDB()
  local arg = (msg or ""):lower():match("^%s*(%S*)")
  if arg == "on" then
    GuildToolsLootDB.enabled = true
    announce("logging Need wins.")
  elseif arg == "off" then
    GuildToolsLootDB.enabled = false
    announce("NOT logging -- use this for old-content or off-progression runs. /gtloot on to resume.")
  elseif arg == "scan" then
    if not GuildToolsLootDB.enabled then
      announce("NOT logging right now -- /gtloot on first, then /gtloot scan.")
    else
      -- Confirms the command actually dispatched before the (synchronous, near-instant)
      -- scan runs -- if this never shows, the command itself never fired; if this shows
      -- but the result line never follows, scanLootHistory() itself errored out (a real
      -- gap found live 2026-08-28 -- Lua errors are silent by default, so without this
      -- line there was no way to tell "didn't run" from "ran and crashed").
      announce("Scanning now…")
      local added = scanLootHistory()
      -- The reload nudge only applies when there's actually something new: SavedVariables
      -- only flush to disk on /reload or logout, and that's the only way Guild Tools (the
      -- app) can pick up a scan's results -- confirmed live 2026-08-29 as the cause of
      -- "scanned, but the app never updated" (officer never reloaded after scanning).
      announce(added > 0 and (added .. " new Need win" .. (added == 1 and "" or "s") .. " pulled in from Loot History. /reload whenever's convenient to confirm the boss/slot in Guild Tools.") or "Loot History checked -- nothing new to add.")
    end
  else
    sampleChatLogging(function(result)
      StaticPopup_Show("GUILDTOOLSLOOT_STATUS", buildStatusText(result))
    end)
  end
end
