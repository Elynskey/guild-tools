-- The red "click here to reload" button and the minimap button on the REAL addon, in a mocked client where every frame is its
-- own table. Time is driven by hand (GetTime + the ticker's OnUpdate) so the quiet period can be checked.
local printed = {}
local function noop() end

local frames = {}
local function newObject(fields)
  local o = setmetatable(fields or {}, { __index = function(t) return function() return t end end })
  o.SetText = function(self, text) self.text = text end
  o.GetText = function(self) return self.text end
  o.SetTexture = function(self, path) self.texture = path end
  o.SetScript = function(self, name, fn) self.scripts[name] = fn end
  o.GetScript = function(self, name) return self.scripts[name] end
  o.RegisterEvent = function(self, ev) self.events[ev] = true end
  o.Show = function(self) self.shown = true end
  o.Hide = function(self) self.shown = false end
  o.IsShown = function(self) return self.shown == true end
  o.GetWidth = function() return 140 end
  o.GetCenter = function() return 0, 0 end
  o.GetEffectiveScale = function() return 1 end
  o.CreateFontString = function() return newObject({ scripts = {}, events = {} }) end
  o.CreateTexture = function() return newObject({ scripts = {}, events = {} }) end
  return o
end
function CreateFrame(kind, name, parent, template)
  local f = newObject({ kind = kind, name = name, template = template, scripts = {}, events = {}, shown = false })
  frames[#frames + 1] = f
  return f
end
UIParent = {}
Minimap = newObject({ scripts = {}, events = {} })
UISpecialFrames = {}
DEFAULT_CHAT_FRAME = { AddMessage = function(_, m) printed[#printed + 1] = m end }
StaticPopupDialogs = {}
StaticPopup_Show = noop
local now = 1000
GetTime = function() return now end
date = os.date
time = os.time
UnitName = function() return "Tester" end
UnitFullName = function() return "Tester", "ArgentDawn" end
GetUnitName = function() return "Tester-ArgentDawn" end
GetRealmName = function() return "Argent Dawn" end
IsInRaid = function() return true end
IsInGroup = function() return true end
C_Timer = { After = function(_, fn) fn() end }
C_ChatInfo = { IsLoggingChat = function() return true end }
LoggingChat = noop
SlashCmdList = {}
IsInInstance = function() return true, "raid" end
GetInstanceInfo = function() return "The Venomous Abyss", "raid", 15, "", 25, 0, false, 3004 end
GetCursorPosition = function() return 100, 0 end
local reloads = 0
ReloadUI = function() reloads = reloads + 1 end
local inEncounter, inCombat = false, false
IsEncounterInProgress = function() return inEncounter end
InCombatLockdown = function() return inCombat end
GuildToolsLootDB = nil

local before = #frames
local ok, err = pcall(dofile, "addon/GuildToolsLoot/GuildToolsLoot.lua")
assert(ok, "load error: " .. tostring(err))

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end

-- the frames this feature adds: a login starter, a ticker, then (on login) the minimap button
local starter, ticker
for i = before + 1, #frames do
  local f = frames[i]
  if f.events.PLAYER_LOGIN and f ~= frames[before + 1] and not starter then starter = f end
  if f.scripts.OnUpdate and not ticker then ticker = f end
end
check("the addon has a login starter and a ticker for the reload button", starter ~= nil and ticker ~= nil)

local function tick()
  ticker.scripts.OnUpdate(ticker, 2.5)
end
local function findButton(name)
  for _, f in ipairs(frames) do if f.name == name then return f end end
end

starter.scripts.OnEvent(starter, "PLAYER_LOGIN")
local mini = findButton("GuildToolsLootMinimapButton")
check("a minimap button is created on login, in the Minimap", mini ~= nil)

-- nothing captured yet: no red button
now = now + 60
tick()
check("no red button while nothing new is logged", findButton("GuildToolsLootReloadButton") == nil)

-- a win is logged
table.insert(GuildToolsLootDB.records, { winner = "Alpha", itemLink = "[X]", time = 1 })
now = now + 1
tick()
check("not shown the moment loot is logged (quiet period first)", findButton("GuildToolsLootReloadButton") == nil or not findButton("GuildToolsLootReloadButton"):IsShown())
now = now + 20
tick()
local btn = findButton("GuildToolsLootReloadButton")
check("shown once things have been quiet", btn ~= nil and btn:IsShown())
check("it says what to do, in capitals", btn ~= nil and btn.text and btn.text:find("CLICK HERE TO RELOAD") ~= nil, btn and btn.text)
check("the chat line tells the officer too", table.concat(printed, " "):find("Loot logged: 1 Need win") ~= nil)

-- never during an encounter or combat
inEncounter = true
tick()
check("hidden during an encounter", not btn:IsShown())
inEncounter = false
inCombat = true
tick()
check("hidden in combat", not btn:IsShown())
inCombat = false
tick()
check("back after combat", btn:IsShown())

-- clicking reloads, and leaves a note for the message after the reload
btn.scripts.OnClick(btn)
check("clicking calls ReloadUI exactly once", reloads == 1)
check("a note is saved for after the reload", GuildToolsLootDB.reloadNote ~= nil and GuildToolsLootDB.reloadNote.wins == 1)

-- right-click on the minimap button turns the prompt off, and back on
printed = {}
mini.scripts.OnClick(mini, "RightButton")
check("right-click turns the red button off", GuildToolsLootDB.reloadPromptOff == true and not btn:IsShown())
mini.scripts.OnClick(mini, "RightButton")
check("right-click again turns it back on", GuildToolsLootDB.reloadPromptOff == false and btn:IsShown())

-- left-click opens the /gtloot window
mini.scripts.OnClick(mini, "LeftButton")
local panel = findButton("GuildToolsLootPanel")
check("left-click opens the /gtloot window", panel ~= nil and panel:IsShown())

-- dragging moves it around the minimap and remembers the angle
mini.scripts.OnDragStart(mini)
mini.scripts.OnUpdate(mini)
check("dragging saves an angle", type(GuildToolsLootDB.minimapAngle) == "number")
mini.scripts.OnDragStop(mini)
check("dragging stops following the cursor", mini.scripts.OnUpdate == nil)

-- after a reload: a fresh session reads the note once
local noteSaved = GuildToolsLootDB.reloadNote
printed = {}
starter.scripts.OnEvent(starter, "PLAYER_LOGIN")
check("after the reload the officer is told the loot is saved", table.concat(printed, " "):find("Loot logged and saved: 1 Need win") ~= nil)
check("...and the note is used up", GuildToolsLootDB.reloadNote == nil)
now = now + 60
tick()
check("a fresh session has nothing pending, so no button", not btn:IsShown())

print(checks .. " checks, " .. failed .. " failed")
if failed > 0 then os.exit(1) end
