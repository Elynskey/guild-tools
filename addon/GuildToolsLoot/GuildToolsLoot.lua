-- Guild Tools Loot -- logs Need-roll wins (and trades this character is part of) so
-- Guild Tools' desktop app can build a loot history. See the app repo's plan notes for
-- the full design; the short version: this addon only ever writes plain Lua tables to
-- its own SavedVariables and lets WoW's built-in saved-variable persistence handle
-- serialization -- no custom encode/decode logic here, on purpose, since this file
-- can't be tested against a live game client from where it was written. The Electron
-- side does the (testable) work of reading these tables back out.
--
-- On by default (most raid nights are current-tier progression). /gtloot opens a small
-- window with buttons: stop or start logging (for old-content farms, alt runs, or anything
-- else that shouldn't feed the loot history), scan Loot History for missed wins, restart
-- chat logging, and the current state.
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

-- Assigned once sampleChatLogging exists further down -- the raid-entry popup's OnAccept
-- (defined well above it) needs to call this at click time, not at file load.
local ensureChatLogging

-- Confirmed live 2026-09-12: an officer had this addon capturing wins correctly (the
-- in-game "Need win captured" announcement fired every time) but Guild Tools never
-- updated live -- because the app's live-loot path doesn't read anything this addon
-- writes at all. It tails WoW's own chat LOG FILE on disk instead (continuous, unlike
-- SavedVariables), which Blizzard's client only writes if chat logging is turned on
-- via /chatlog -- a one-time, easy-to-forget setting with no in-game indicator of its
-- own. This is the same check the default UI's own "Log all chat" option reads,
-- guarded like every other less-than-certain API in this file.
--
-- The underlying API moved: confirmed live 2026-09-19 that the global IsChatLogging()
-- this used to call no longer exists at all on this client (`_G.IsChatLogging` reads
-- nil) -- a real officer report of "Chat logging status unavailable on this client"
-- traced back to that, not a guess. A live scan of C_ChatInfo's own keys (not
-- documentation, an actual `for k in pairs(C_ChatInfo)` on a real client) found the
-- replacement: C_ChatInfo.IsLoggingChat(). Wrapped in isChatLoggingAPI() rather than
-- called directly everywhere so a future rename only needs updating in one place.
--
-- The underlying reading still isn't fully trustworthy even with the right function --
-- confirmed live 2026-09-12 (back when it was still the global): it read OFF for an
-- officer who had chat logging genuinely on. Root cause unconfirmed (possibly a CVar
-- that hasn't settled yet at the moment this happens to be called). Two mitigations,
-- not a real fix (there's no file access from in-game Lua to verify against directly):
--   1. Once a true reading is ever seen this session, remembered -- a later false
--      reading is reported as "reads off, but was on earlier" rather than a flat
--      contradiction of something the officer already confirmed with their own eyes.
--   2. /gtloot's on-demand check (not this passive reminder) samples twice, a beat
--      apart, before reporting -- cheap insurance against a one-off transient read.
local chatLoggingSeenOnThisSession = false

local function isChatLoggingAPI()
  return C_ChatInfo and C_ChatInfo.IsLoggingChat
end

local function chatLoggingStatusLine()
  if not isChatLoggingAPI() then return 'unavailable on this client', nil end
  local isOn = C_ChatInfo.IsLoggingChat()
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
    announce('chat logging ' .. line .. ' -- Guild Tools needs it for live loot updates. Type /chatlog -- it starts working right away, no need to log out. It switches itself off every time you log out to the character screen, so it has to be on again each session.')
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

-- Which character is logged in right now, written into SavedVariables so the Guild
-- Tools app can read it instead of making the officer type their name (it needs it to
-- resolve WoW's chat log calling their own wins "You"). Only reaches disk on /reload
-- or logout like everything else here -- so it's the CURRENT character once a reload
-- has happened this session, and the previous session's until then (the app labels
-- that caveat). Recorded at login AND every loading screen, since an officer who swaps
-- alts and /reloads should update it without a full relog.
local function recordCharacter()
  local name, realm = playerRealmName()
  if name then GuildToolsLootDB.character = { name = name, realm = realm, at = time() } end
end

-- The game's own reading of whether chat logging is on, saved so Guild Tools can tell "logging is ON and WoW just has
-- not written the file yet" from "logging is OFF". WoW keeps chat lines in memory and writes WoWChatLog.txt only at a
-- /reload or logout (confirmed live 2026-09-19, WoW 12.1.0), so the file's timestamp alone says "not logging" during
-- any quiet or buffered stretch. Recorded a few seconds after login (once the automatic re-enable has run) and at
-- PLAYER_LOGOUT, which fires just before SavedVariables are written on both /reload and logout, so the reading that
-- reaches disk is the current one.
local function recordChatLogging()
  if not isChatLoggingAPI() then return end
  GuildToolsLootDB.chatLogging = { on = C_ChatInfo.IsLoggingChat() and true or false, at = time() }
end

-- True when the winner is this very character. The app pairs the chat log's anonymous
-- "You" win (which can't say WHO) with this addon's own record of it by matching on
-- this flag -- exact even if the app guessed the wrong character name before a reload.
local function isSelf(winnerName)
  local me = UnitName("player")
  return me ~= nil and winnerName ~= nil and winnerName:match("^[^-]+") == me
end

-- "[Loot]: <name> (<roll type> - <roll value>) Won: " -- captures (1) the winner's name
-- and (2) the roll-type word, leaving the item link for extractItemLink() to pull from
-- the same message separately (it carries the full |Hitem:...|h escape sequence, not
-- just the plain bracketed name this pattern's lazy match would stop at).
--
-- Live 2026-09-19 (WoW 12.1.0): the game now writes "(Need - 75, Main-Spec)" -- a ", Main-Spec" /
-- ", Off-Spec" qualifier after the roll value, still inside the parens. The old pattern required
-- the paren to close right after the number, so it matched NOTHING and every win in that session
-- was captured only by the C_LootHistory path below (the redundancy did its job). `[^%)]*` lets
-- the qualifier through. A win by the local player arrives as the word "You" here, while the
-- C_LootHistory path records the real name; the handler below maps "You" to this character so
-- the two paths dedupe against each other instead of recording one win twice.
local WON_ROLL_PATTERN = "%[Loot%]: (.-) %((.-) %- %d+[^%)]*%) Won: "

-- Live 2026-09-20 (WoW 12.1.0), the exact text the game hands CHAT_MSG_LOOT for a roll:
--   |HlootHistory:3470|h[Loot]|h: You (Need - 51, Main-Spec) Won: |cnIQ4:|Hitem:270930::...::|h[Tomb-Creeper's Claw]|h|r
-- Two more changes since this parser was written: the word "Loot" is now a hyperlink to the loot-history window (the number
-- is the encounter ID), and item links open with a named color ("|cnIQ4:") instead of hex digits. Neither matched, so this
-- whole chat-text path captured nothing, and only the C_LootHistory path below was working. plainLootText() strips
-- hyperlink wrappers (keeping the text they show) for the pattern; the item link is still taken from the original message.
local function plainLootText(message)
  return (message:gsub("|H.-|h(.-)|h", "%1"))
end

local function extractItemLink(message)
  return message:match("(|c[^|]+|Hitem:.-|h|r)")
end

local function itemIdFromLink(link)
  if not link then return nil end
  return tonumber(link:match("item:(%d+)"))
end

-- Blizzard's itemClassID for Recipe, and itemClassID/itemSubClassID for Companion Pets
-- -- stable across expansions, the same values every other addon that reads them
-- hardcodes (there's no client-exposed global that names them). Confirmed against
-- Warcraft Wiki's item-type table, not guessed.
local ITEM_CLASS_CONSUMABLE = 0
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

-- Flasks, potions, runes and food change hands constantly and are not loot anyone is tracking, so trades of them are not recorded
-- (the officers' decision, 2026-09-23: two Vantus Rune / Flask trades were showing up in Loot History).
local function isConsumable(itemId)
  if not itemId then return false end
  local _, _, _, _, _, itemClassID = GetItemInfoInstant(itemId)
  return itemClassID == ITEM_CLASS_CONSUMABLE
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

-- The boss's name for an encounter ID. The chat path knows the encounter from the "Loot" link in the message but nothing else, and
-- currentBoss is only whatever ENCOUNTER_START last set -- empty after a /reload, or when the roll resolves for another pull. Found
-- live in an LFR test night (2026-09-23): wins captured with encounter 3445 and no boss, though the name was in seenEncounters.
local function bossForEncounter(encounterId)
  if not encounterId then return nil end
  local seen = GuildToolsLootDB.seenEncounters and GuildToolsLootDB.seenEncounters[tostring(encounterId)]
  if seen then return seen end
  if C_LootHistory and C_LootHistory.GetAllEncounterInfos then
    local ok, infos = pcall(C_LootHistory.GetAllEncounterInfos)
    if ok and type(infos) == "table" then
      for _, info in ipairs(infos) do
        if info.encounterID == encounterId and info.encounterName then return info.encounterName end
      end
    end
  end
  return nil
end

local function resolveBoss(bossOverride, encounterId)
  return bossOverride or bossForEncounter(encounterId) or currentBoss
end

-- Names the boss on records saved without one, now that the encounter's name is known (runs at login, so a sync-reload fixes them).
local function backfillBosses()
  for _, list in ipairs({ GuildToolsLootDB.records or {}, GuildToolsLootDB.needLosses or {} }) do
    for _, r in ipairs(list) do
      if not r.boss and r.encounterId then r.boss = bossForEncounter(r.encounterId) end
    end
  end
end

local function recordNeedWin(winnerName, itemLink, bossOverride, encounterIDOverride, difficultyOverride, lootListID)
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
  local encounterId = encounterIDOverride or currentEncounterID
  for _, r in ipairs(GuildToolsLootDB.records) do
    if r.itemId == itemId and r.winner == winnerName and math.abs(r.time - now) <= DEDUP_WINDOW_SECONDS then
      -- Two drops of the same item in one encounter have different lootListIDs: a different win, not a second sighting of
      -- the same one. Only when BOTH sides carry the ID; without it (the chat-text path has none) the old rule stands.
      local differentDrop = lootListID ~= nil and r.lootListId ~= nil and (r.lootListId ~= lootListID or r.encounterId ~= encounterId)
      if not differentDrop then
        -- The chat message and the game's loot history report the same win, and the chat message usually lands first with no drop
        -- ID (live LFR test 2026-09-23: 14 of 14 wins had none while all 74 lost rolls, which only come from the loot history, did).
        -- When the loot history reports it second, attach its ID to the record instead of throwing it away.
        if lootListID ~= nil and r.lootListId == nil then
          r.lootListId = lootListID
          r.encounterId = r.encounterId or encounterId
          r.boss = r.boss or resolveBoss(bossOverride, encounterId)
        end
        return
      end
    end
  end

  table.insert(GuildToolsLootDB.records, {
    itemId = itemId,
    itemLink = itemLink,
    winner = winnerName,
    boss = resolveBoss(bossOverride, encounterId),
    slot = slotLabel(itemLink),
    time = now,
    difficulty = difficultyOverride or currentDifficulty,
    -- Which encounter this came from. Lets the store tell that two officers' records (or a late backfill scan's) are the
    -- SAME win however far apart their capture times are, instead of relying on a 60-second window.
    encounterId = encounterId,
    -- The game's own ID for this drop within the encounter (C_LootHistory only). With the encounter it identifies the roll
    -- exactly, so the shared store can tell two officers' copies of ONE roll from two separate rolls, whatever the times.
    lootListId = lootListID,
    self = isSelf(winnerName) or nil,
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
local function recordNeedLoss(loserName, itemLink, bossOverride, encounterIDOverride, difficultyOverride, lootListID)
  if not GuildToolsLootDB.enabled or not loserName or not itemLink then return end
  if not isTrackedEncounter(encounterIDOverride or currentEncounterID) then return end
  local itemId = itemIdFromLink(itemLink)
  if isExcludedFromNeedTracking(itemId) then return end

  -- Same dedup rationale as recordNeedWin -- a rescan re-surfacing an older loss must
  -- not re-insert it. 6-hour window matches recordNeedWin and this app's own
  -- same-raid-night grouping threshold.
  local now = time()
  local DEDUP_WINDOW_SECONDS = 6 * 60 * 60
  local encounterId = encounterIDOverride or currentEncounterID
  for _, r in ipairs(GuildToolsLootDB.needLosses) do
    if r.itemId == itemId and r.name == loserName and math.abs(r.time - now) <= DEDUP_WINDOW_SECONDS then
      -- Someone who rolled Need on BOTH copies of a drop loses twice: two rolls, two lootListIDs. Only collapse a repeat
      -- sighting of the same roll (same ID, or no ID to tell them apart).
      local differentDrop = lootListID ~= nil and r.lootListId ~= nil and (r.lootListId ~= lootListID or r.encounterId ~= encounterId)
      if not differentDrop then return end
    end
  end

  table.insert(GuildToolsLootDB.needLosses, {
    itemId = itemId,
    itemLink = itemLink,
    name = loserName,
    boss = resolveBoss(bossOverride, encounterId),
    slot = slotLabel(itemLink),
    time = now,
    difficulty = difficultyOverride or currentDifficulty,
    encounterId = encounterId,
    lootListId = lootListID,
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
  -- (EJ_GetEncounterInfo is NOT used: it takes an Encounter Journal ID, not this dungeon-encounter ID, so it can name the wrong boss.
  -- recordNeedWin resolves a missing name from the encounter ID itself.)
  local bossName = bossNameHint

  recordNeedWin(dropInfo.winner.playerName, dropInfo.itemHyperlink, bossName, encounterID, nil, lootListID)

  for _, roll in ipairs(dropInfo.rollInfos) do
    if not roll.isWinner and (roll.state == NEED_MAIN_SPEC_STATE or roll.state == NEED_OFF_SPEC_STATE) then
      recordNeedLoss(roll.playerName, dropInfo.itemHyperlink, bossName, encounterID, nil, lootListID)
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
    announce("logging Need wins for this raid. Open /gtloot to stop any time.")
    ensureChatLogging(true)
  end,
  -- Deliberately no OnCancel that touches `enabled`. Blizzard's StaticPopup calls
  -- OnCancel for an explicit button2 click AND for the player just hitting Escape AND
  -- for another popup pre-empting this one (reason: "clicked" for both of the first
  -- two -- genuinely indistinguishable from inside OnCancel; "override" for the third)
  -- -- confirmed against Blizzard's own StaticPopup docs, not assumed. A stray Escape
  -- press or an unrelated popup taking priority must never silently kill a whole
  -- raid's logging with zero real user action. Turning logging OFF is only ever
  -- explicit now, via the /gtloot window's Stop button -- this popup can only ever turn it ON.
  timeout = 0,
  whileDead = true,
  hideOnEscape = true,
  preferredIndex = 3,
}

-- A real popup instead of a chat line -- confirmed live twice now (2026-09-11,
-- 2026-09-12) that whether /chatlog is actually on is exactly the thing officers get
-- wrong without noticing, and a chat message scrolls away/gets missed in raid spam.
-- The /gtloot window shows this instead of only printing to chat; the button actions
-- stay chat-only since those are already confirming something the player just did.
-- Samples C_ChatInfo.IsLoggingChat() twice, ~0.5s apart, before this on-demand check
-- reports -- cheap insurance against the one-off transient false read confirmed live
-- 2026-09-12 (an officer had chat logging genuinely on and this read it as off). Not a
-- fix for a wrong reading that persists across both samples -- there's no way to check
-- the actual log file from in-game Lua -- just narrows the window a truly transient
-- hiccup could land in. Only used here, not in the passive login/raid-entry reminder or
-- the capture-time warning -- those fire automatically and shouldn't add a delay.
local function sampleChatLogging(callback)
  if not isChatLoggingAPI() then
    callback(nil)
    return
  end
  if C_ChatInfo.IsLoggingChat() then
    chatLoggingSeenOnThisSession = true
    callback(true)
    return
  end
  C_Timer.After(0.5, function()
    local second = C_ChatInfo.IsLoggingChat()
    if second then chatLoggingSeenOnThisSession = true end
    callback(second)
  end)
end

-- Turns chat logging on when logging is being switched on (Start logging in the /gtloot window, answering Yes
-- to the raid-entry popup, or automatically a few seconds after login -- chat logging
-- resets on every logout to the character screen), so an officer doesn't have to
-- remember /chatlog separately. Only ever acts while chat logging reads OFF: the /chatlog slash handler
-- TOGGLES, so calling it while already on would switch it back off. LoggingChat(true)
-- is tried first (the setter twin of LoggingCombat, which other current addons on this
-- client still call -- its chat counterpart is by analogy, not confirmed), then the
-- slash handler. Either way the result is re-read afterward and reported honestly
-- rather than assumed, since this whole feature has already failed silently once.
ensureChatLogging = function(explicit)
  if not isChatLoggingAPI() then return end
  if C_ChatInfo.IsLoggingChat() then
    chatLoggingSeenOnThisSession = true
    return
  end
  if LoggingChat then
    LoggingChat(true)
  elseif explicit and SlashCmdList and SlashCmdList["CHATLOG"] then
    SlashCmdList["CHATLOG"]("")
  elseif explicit then
    announce("couldn't turn chat logging on by itself on this client -- type /chatlog yourself.")
    return
  else
    return -- automatic (login) path never uses the toggle; the reminder that follows covers this
  end
  C_Timer.After(0.5, function()
    if C_ChatInfo.IsLoggingChat() then
      chatLoggingSeenOnThisSession = true
      announce("chat logging turned ON for you -- live updates to Guild Tools should start now.")
    elseif explicit then
      announce("tried to turn chat logging on but it still reads OFF -- type /chatlog yourself.")
    end
  end)
end

-- The /gtloot window's Restart chat logging button: an explicit restart for when the game reads ON but
-- Guild Tools says nothing is being written (seen live 2026-09-19: several officers had
-- it ON in game while their apps reported no writes). Cycles it off, then on, which is what
-- typing /chatlog twice does, and only ever runs because an officer asked for it. Uses the
-- LoggingChat setter when this client has it, otherwise the /chatlog toggle guarded by the
-- current reading so it can never flip the wrong way. Whether the file is really being
-- written can't be checked from in-game Lua; the app's "Verify chat logging" button does that.
local function restartChatLogging()
  if not isChatLoggingAPI() then
    announce("can't read chat logging on this client -- type /chatlog twice yourself (off, then on).")
    return
  end
  local function setLogging(on)
    if C_ChatInfo.IsLoggingChat() == on then return end
    if LoggingChat then
      LoggingChat(on)
    elseif SlashCmdList and SlashCmdList["CHATLOG"] then
      SlashCmdList["CHATLOG"]("")
    end
  end
  announce("restarting chat logging…")
  setLogging(false)
  C_Timer.After(0.6, function()
    setLogging(true)
    C_Timer.After(0.6, function()
      if C_ChatInfo.IsLoggingChat() then
        chatLoggingSeenOnThisSession = true
        announce("chat logging restarted and ON. In Guild Tools, press \"Verify chat logging\" to confirm it is really writing.")
      else
        announce("chat logging still reads OFF -- type /chatlog yourself.")
      end
    end)
  end)
end

-- =========================== the /gtloot window ===========================
-- /gtloot opens a small window with buttons, so there are no sub-commands to remember. It is built on first use; a client that
-- cannot draw it gets the same facts in chat.
-- chatLoggingResult is true/false/nil, already resolved by sampleChatLogging above -- kept as a plain parameter (not re-sampled
-- in here) so this stays synchronous.
local function statusTexts(chatLoggingResult)
  local logging = GuildToolsLootDB.enabled and "|cff5f9e4aLogging Need wins|r" or "|cffa83232NOT logging Need wins|r (old content or an alt run?)"
  local chatLogging
  if chatLoggingResult == nil then
    chatLogging = "Chat logging status unavailable on this client"
  elseif chatLoggingResult == true then
    chatLogging = "|cff5f9e4aChat logging is ON|r -- live updates will reach Guild Tools"
  elseif chatLoggingSeenOnThisSession then
    chatLogging = "|cffc0902fChat logging reads OFF right now, but was ON earlier this session|r -- possibly a stale read. Trust Interface Options if it disagrees, or press Restart chat logging."
  else
    chatLogging = "|cffa83232Chat logging is OFF|r -- press Restart chat logging (or type /chatlog). It resets whenever you log out to the character screen."
  end
  return logging, chatLogging
end

local gtPanel

local function refreshPanel()
  if not gtPanel then return end
  -- Samples chat logging (twice when it reads off), so the check time also shows that a Refresh did something.
  sampleChatLogging(function(result)
    local logging, chatLogging = statusTexts(result)
    gtPanel.loggingText:SetText(logging)
    gtPanel.chatText:SetText(chatLogging)
    gtPanel.checkedText:SetText("Checked " .. date("%H:%M:%S") .. ". Wins reach Guild Tools when you /reload or log out.")
    gtPanel.buttons.toggle:SetText(GuildToolsLootDB.enabled and "Stop logging Need wins" or "Start logging Need wins")
  end)
end

local function toggleLogging()
  if GuildToolsLootDB.enabled then
    GuildToolsLootDB.enabled = false
    announce("NOT logging -- use this for old-content or off-progression runs. Open /gtloot and press Start logging to resume.")
  else
    GuildToolsLootDB.enabled = true
    announce("logging Need wins.")
    ensureChatLogging(true)
  end
  refreshPanel()
end

local function runScan()
  if not GuildToolsLootDB.enabled then
    announce("NOT logging right now -- press Start logging first, then Scan.")
    return
  end
  -- Confirms the button actually did something before the (synchronous, near-instant) scan runs -- if this never shows, the
  -- click never fired; if this shows but the result line never follows, scanLootHistory() itself errored out (Lua errors are
  -- silent by default, so without this line there was no way to tell "didn't run" from "ran and crashed").
  announce("Scanning now…")
  local added = scanLootHistory()
  -- The reload nudge only applies when there is something new: SavedVariables only flush to disk on /reload or logout, and
  -- that is the only way Guild Tools (the app) can pick up a scan's results.
  announce(added > 0 and (added .. " new Need win" .. (added == 1 and "" or "s") .. " pulled in from Loot History. /reload whenever's convenient to confirm the boss/slot in Guild Tools.") or "Loot History checked -- nothing new to add.")
end

local function restartChatLoggingFromPanel()
  restartChatLogging()
  C_Timer.After(1.6, refreshPanel)
end

local function makePanelButton(parent, label, y, onClick)
  local b = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
  b:SetSize(300, 28)
  b:SetPoint("TOP", parent, "TOP", 0, y)
  b:SetText(label)
  b:SetScript("OnClick", onClick)
  return b
end

local function buildPanel()
  local f = CreateFrame("Frame", "GuildToolsLootPanel", UIParent, "BackdropTemplate")
  f:SetSize(340, 292)
  f:SetPoint("CENTER", UIParent, "CENTER", 0, 80)
  f:SetFrameStrata("DIALOG")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self) self:StopMovingOrSizing() end)
  if f.SetBackdrop then
    f:SetBackdrop({
      bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
      edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
      tile = true, tileSize = 32, edgeSize = 24,
      insets = { left = 6, right = 6, top = 6, bottom = 6 },
    })
  end

  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetTexture("Interface\\AddOns\\GuildToolsLoot\\crd-logo")
  f.icon:SetSize(38, 38)
  f.icon:SetPoint("TOPLEFT", f, "TOPLEFT", 16, -14)

  f.title = f:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  f.title:SetPoint("TOPLEFT", f.icon, "TOPRIGHT", 8, -2)
  f.title:SetText("Guild Tools Loot")
  f.sub = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.sub:SetPoint("TOPLEFT", f.title, "BOTTOMLEFT", 0, -2)
  f.sub:SetText("Casual Raid Days")

  f.close = CreateFrame("Button", nil, f, "UIPanelCloseButton")
  f.close:SetPoint("TOPRIGHT", f, "TOPRIGHT", -4, -4)

  f.loggingText = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  f.loggingText:SetPoint("TOPLEFT", f, "TOPLEFT", 20, -66)
  f.loggingText:SetWidth(300)
  f.loggingText:SetJustifyH("LEFT")
  f.chatText = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.chatText:SetPoint("TOPLEFT", f.loggingText, "BOTTOMLEFT", 0, -6)
  f.chatText:SetWidth(300)
  f.chatText:SetHeight(48)
  f.chatText:SetJustifyH("LEFT")
  f.chatText:SetJustifyV("TOP")

  f.buttons = {
    toggle = makePanelButton(f, "Stop logging Need wins", -150, toggleLogging),
    scan = makePanelButton(f, "Scan Loot History for missed wins", -184, runScan),
    chatlog = makePanelButton(f, "Restart chat logging", -218, restartChatLoggingFromPanel),
  }

  f.checkedText = f:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
  f.checkedText:SetPoint("BOTTOM", f, "BOTTOM", 0, 14)
  f.checkedText:SetWidth(300)

  f:SetScript("OnShow", refreshPanel)
  if UISpecialFrames then table.insert(UISpecialFrames, "GuildToolsLootPanel") end
  f:Hide()
  return f
end

local function togglePanel()
  if not gtPanel then
    local ok, built = pcall(buildPanel)
    if not ok then
      sampleChatLogging(function(result)
        local logging, chatLogging = statusTexts(result)
        announce(logging)
        announce(chatLogging)
        announce("This client could not draw the /gtloot window.")
      end)
      return
    end
    gtPanel = built
  end
  if gtPanel:IsShown() then gtPanel:Hide() else gtPanel:Show() end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("PLAYER_LOGOUT")
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
    recordCharacter()
    backfillBosses()
    if GuildToolsLootDB.enabled then
      announce('logging Need wins (open /gtloot to stop for this run).')
    else
      announce('NOT logging (open /gtloot and press Start logging to resume).')
    end
    -- Chat logging switches itself off every time a character logs out to the character
    -- screen (confirmed live 2026-09-19), so it has to be turned back on each session --
    -- done here for the officer instead of relying on them to remember /chatlog. Delayed
    -- a few seconds so the client has settled (this exact reading was flaky right at
    -- login before), and automatic (not explicit): it only ever uses the idempotent
    -- LoggingChat(true) setter, never the /chatlog toggle, so a transient wrong "OFF"
    -- reading can't flip a genuinely-on setting off. The reminder runs after it, so it
    -- only nags if that didn't work.
    C_Timer.After(5, function()
      if GuildToolsLootDB.enabled then ensureChatLogging(false) end
      C_Timer.After(1, function()
        recordChatLogging()
        remindChatLoggingIfOff()
      end)
    end)

  elseif event == "PLAYER_LOGOUT" then
    recordChatLogging()

  elseif event == "PLAYER_ENTERING_WORLD" then
    recordCharacter()
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
    -- Chat text is a protected value while an encounter is in progress (WoW 12): nothing here can read it, and rolls
    -- only resolve after the boss is down, so skipping it costs nothing.
    if issecretvalue and issecretvalue(message) then return end
    local winner, rollType = plainLootText(message):match(WON_ROLL_PATTERN)
    if winner and rollType and rollType:lower():find("need") then
      if winner == "You" then winner = UnitName("player") or winner end
      local link = extractItemLink(message)
      -- The link around the word "Loot" carries the encounter ID: |HlootHistory:3470|h[Loot]|h
      local linkedEncounterID = tonumber(message:match("|HlootHistory:(%d+)|h"))
      if link then recordNeedWin(winner, link, nil, linkedEncounterID) end
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
        local itemId = itemIdFromLink(link)
        if not isConsumable(itemId) then
          table.insert(GuildToolsLootDB.trades, {
            itemId = itemId,
            itemLink = link,
            from = myName,
            to = tradeTargetName,
            time = time(),
          })
        end
      end
    end
    tradeTargetName = nil
    tradePlayerItems = {}
    tradeCompleted = false
  end
end)

SLASH_GUILDTOOLSLOOT1 = "/gtloot"
-- One command, no arguments: everything it used to do (on, off, scan, chatlog) is a button in the window.
SlashCmdList["GUILDTOOLSLOOT"] = function()
  ensureDB()
  togglePanel()
end
