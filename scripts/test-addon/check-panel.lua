-- The /gtloot window: one command, a window with buttons, no sub-commands. Loads the REAL addon (and the generated test copy) into a
-- mocked client where every frame is its own table, so the window's texts, buttons and crest can be read back.
local printed = {}
local function noop() end

local frames = {}
local failTemplates = false
local function newObject(fields)
  local o = setmetatable(fields or {}, { __index = function(t) return function() return t end end })
  o.SetText = function(self, text) self.text = text end
  o.GetText = function(self) return self.text end
  o.SetTexture = function(self, path) self.texture = path end
  o.SetScript = function(self, name, fn) self.scripts[name] = fn end
  o.GetScript = function(self, name) return self.scripts[name] end
  o.RegisterEvent = function(self, ev) self.events[ev] = true end
  o.Show = function(self)
    self.shown = true
    if self.scripts.OnShow then self.scripts.OnShow(self) end
  end
  o.Hide = function(self) self.shown = false end
  o.IsShown = function(self) return self.shown == true end
  o.CreateFontString = function() return newObject({ scripts = {}, events = {} }) end
  o.CreateTexture = function() return newObject({ scripts = {}, events = {} }) end
  return o
end
function CreateFrame(kind, name, parent, template)
  if failTemplates and template then error("template not available: " .. template) end
  local f = newObject({ kind = kind, name = name, template = template, scripts = {}, events = {}, shown = false })
  frames[#frames + 1] = f
  return f
end
UIParent = {}
UISpecialFrames = {}
DEFAULT_CHAT_FRAME = { AddMessage = function(_, m) printed[#printed + 1] = m end }
StaticPopupDialogs = {}
StaticPopup_Show = noop
GetTime = function() return 0 end
date = os.date
time = os.time
UnitName = function() return "Tester" end
UnitFullName = function() return "Tester", "ArgentDawn" end
GetUnitName = function() return "Tester-ArgentDawn" end
GetRealmName = function() return "Argent Dawn" end
IsInRaid = function() return true end
IsInGroup = function() return true end
C_Timer = { After = function(_, fn) fn() end }
local chatState = true
C_ChatInfo = { IsLoggingChat = function() return chatState end }
LoggingChat = function(on) chatState = on end
SlashCmdList = {}
IsInInstance = function() return true, "raid" end
GetInstanceInfo = function() return "The Venomous Abyss", "raid", 17, "", 25, 0, false, 3004 end
GetDifficultyInfo = function(id) return ({ [17] = "Looking For Raid", [15] = "Heroic" })[id] end
C_LootHistory = nil

local checks, failed = 0, 0
local function check(name, cond, detail)
  checks = checks + 1
  if not cond then failed = failed + 1 end
  print((cond and "ok   " or "FAIL ") .. name .. (detail and ("  | " .. detail) or ""))
end
local function say(cmd, msg)
  printed = {}
  SlashCmdList[cmd](msg)
  return table.concat(printed, " || ")
end
local function panelNamed(name)
  for _, f in ipairs(frames) do if f.name == name then return f end end
end
local function click(button) button.scripts.OnClick(button) end

-- =========================== the real addon ===========================
GuildToolsLootDB = nil
dofile("addon/GuildToolsLoot/GuildToolsLoot.lua")
check("/gtloot is the only command", SLASH_GUILDTOOLSLOOT1 == "/gtloot" and SLASH_GUILDTOOLSLOOT2 == nil)
check("the old status popup is gone", StaticPopupDialogs["GUILDTOOLSLOOT_STATUS"] == nil)
check("no window exists until /gtloot is used", panelNamed("GuildToolsLootPanel") == nil)

say("GUILDTOOLSLOOT", "")
local panel = panelNamed("GuildToolsLootPanel")
check("/gtloot opens a window", panel ~= nil and panel.shown == true)
check("...that shows our crest", panel and panel.icon.texture == "Interface\\AddOns\\GuildToolsLoot\\crd-logo", panel and tostring(panel.icon.texture))
check("...closes on Escape", (function() for _, n in ipairs(UISpecialFrames) do if n == "GuildToolsLootPanel" then return true end end end)())
check("...and has the title", panel.title.text == "Guild Tools Loot", tostring(panel.title.text))
check("...says logging is on", panel.loggingText.text:find("Logging Need wins", 1, true) and not panel.loggingText.text:find("NOT", 1, true), tostring(panel.loggingText.text))
check("...says chat logging is on", panel.chatText.text:find("Chat logging is ON", 1, true), tostring(panel.chatText.text))
check("...shows when it checked", panel.checkedText.text:find("Checked ", 1, true))
check("...with a stop button (logging is on)", panel.buttons.toggle.text == "Stop logging Need wins", tostring(panel.buttons.toggle.text))
check("...a scan button and a chat logging restart button", panel.buttons.scan.text:find("Scan") and panel.buttons.chatlog.text == "Restart chat logging")

say("GUILDTOOLSLOOT", "")
check("/gtloot again closes it", panel.shown == false)
say("GUILDTOOLSLOOT", "off")
check("the old sub-commands are gone: '/gtloot off' opens the window and does not turn logging off", GuildToolsLootDB.enabled ~= false and panel.shown == true)
say("GUILDTOOLSLOOT", "scan")
say("GUILDTOOLSLOOT", "chatlog")
say("GUILDTOOLSLOOT", "on")
check("...nor do scan, chatlog or on do anything", GuildToolsLootDB.enabled ~= false)
panel.shown = true

-- the buttons
printed = {}
click(panel.buttons.toggle)
check("Stop logging turns logging off, says so, and the button becomes Start", GuildToolsLootDB.enabled == false and table.concat(printed, " "):find("NOT logging") and panel.buttons.toggle.text == "Start logging Need wins", tostring(panel.buttons.toggle.text))
check("...and the window's status line follows", panel.loggingText.text:find("NOT logging", 1, true) ~= nil, tostring(panel.loggingText.text))
printed = {}
click(panel.buttons.scan)
check("Scan while logging is off says to start logging first", table.concat(printed, " "):find("press Start logging first", 1, true) ~= nil, table.concat(printed, " || "))
chatState = false
click(panel.buttons.toggle)
check("Start logging turns it on and switches chat logging on too", GuildToolsLootDB.enabled == true and chatState == true and panel.buttons.toggle.text == "Stop logging Need wins", tostring(chatState))
printed = {}
click(panel.buttons.scan)
check("Scan with logging on runs and reports", table.concat(printed, " "):find("Scanning now", 1, true) and table.concat(printed, " "):find("nothing new", 1, true), table.concat(printed, " || "))
chatState = true
printed = {}
click(panel.buttons.chatlog)
check("Restart chat logging cycles it and ends ON", chatState == true and table.concat(printed, " "):find("restarting chat logging", 1, true) and table.concat(printed, " "):find("restarted and ON", 1, true), table.concat(printed, " || "))
check("...and the window says ON afterwards", panel.chatText.text:find("Chat logging is ON", 1, true) ~= nil, tostring(panel.chatText.text))
chatState = false
panel.scripts.OnShow(panel)
check("with chat logging off the window says how to fix it", panel.chatText.text:find("Restart chat logging", 1, true) ~= nil, tostring(panel.chatText.text))
chatState = true

-- the crest ships with the addon
local toc = io.open("addon/GuildToolsLoot/GuildToolsLoot.toc", "rb"):read("*a")
check("the .toc points at the crest", toc:find("## IconTexture: Interface\\AddOns\\GuildToolsLoot\\crd-logo", 1, true) ~= nil)
local tga = io.open("addon/GuildToolsLoot/crd-logo.tga", "rb")
local head = tga and tga:read(18) or ""
if tga then tga:close() end
check("...and the crest file is a 128x128 32-bit TGA", #head == 18 and head:byte(3) == 2 and head:byte(13) + head:byte(14) * 256 == 128 and head:byte(15) + head:byte(16) * 256 == 128 and head:byte(17) == 32)

-- a client that cannot draw the window still gets the facts, in chat
failTemplates = true
frames = {}
GuildToolsLootDB = nil
SlashCmdList = {}
dofile("addon/GuildToolsLoot/GuildToolsLoot.lua")
local out = say("GUILDTOOLSLOOT", "")
check("if the window cannot be drawn, /gtloot prints the status in chat instead", out:find("Logging Need wins", 1, true) and out:find("Chat logging is ON", 1, true) and out:find("could not draw", 1, true), out)
failTemplates = false

-- =========================== the generated test addon ===========================
frames = {}
GuildToolsLootDB = nil
GuildToolsLootTestDB = nil
SlashCmdList = {}
dofile("addon-test/GuildToolsLootTest/GuildToolsLootTest.lua")
say("GUILDTOOLSLOOTTEST", "")
local testPanel = panelNamed("GuildToolsLootTestPanel")
check("the test addon's window has its own name, so both can be open at once", testPanel ~= nil and testPanel.shown == true and panelNamed("GuildToolsLootPanel") == nil)
check("...shows the crest from the TEST addon's folder and says TEST", testPanel.icon.texture == "Interface\\AddOns\\GuildToolsLootTest\\crd-logo" and testPanel.title.text == "Guild Tools Loot TEST", tostring(testPanel.icon.texture) .. " / " .. tostring(testPanel.title.text))
click(testPanel.buttons.toggle)
check("...its Stop button only touches the TEST setting", GuildToolsLootTestDB.enabled == false and GuildToolsLootDB == nil)
say("GUILDTOOLSLOOTTEST", "on")
check("'/gtloottest on' no longer changes anything", GuildToolsLootTestDB.enabled == false)
local testToc = io.open("addon-test/GuildToolsLootTest/GuildToolsLootTest.toc", "rb"):read("*a")
local iconLines = 0
for _ in testToc:gmatch("## IconTexture:") do iconLines = iconLines + 1 end
check("the test addon's .toc has exactly one icon line, pointing at its own crest", iconLines == 1 and testToc:find("AddOns\\GuildToolsLootTest\\crd-logo", 1, true) ~= nil)

print(string.format("\n%d checks, %d failed", checks, failed))
os.exit(failed == 0 and 0 or 1)
